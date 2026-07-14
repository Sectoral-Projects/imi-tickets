import { Closed } from '@/lib/components/closed';
import { ScheduledCloseNotice } from '@/lib/components/scheduledCloseNotice';
import { formatCompactDuration } from '@/lib/discord/formatCompactDuration';
import { logDmSendFailure } from '@/lib/discord/dmErrors';
import { ParticipantDmStatusService } from './participantDmStatus';
import { TicketChannelService } from './ticketChannel';
import { TicketService, ThreadStatus, type CloseThreadInput } from './ticket';
import { AuditAction, AuditService } from './audit';
import { RealtimeService } from './realtime';
import { container } from '@sapphire/framework';
import {
	MessageFlags,
	type APIMessageTopLevelComponent,
	type Message,
	type TextBasedChannel
} from 'discord.js';

function wakeAutoClose() {
	void import('./autoClose.js').then(({ AutoCloseService }) => AutoCloseService.wake());
}

export type CloseTicketInput = CloseThreadInput & {
	/** Skip the member DM when the close notice is shown in the same channel (user DM close). */
	skipMemberDm?: boolean;
};

export type ScheduledCloseNoticeRef = {
	channelId: string;
	messageId: string;
};

export abstract class TicketCloseService {
	static async close(input: CloseTicketInput) {
		const thread = TicketService.findById(input.threadId);
		if (!thread || thread.status !== ThreadStatus.Open) return null;

		const closed = TicketService.close({
			threadId: input.threadId,
			executedBy: input.executedBy,
			reason: input.reason
		});

		if (thread.channelId) {
			await TicketChannelService.deleteStaffChannel(thread.channelId);
			TicketService.clearStaffChannelId(thread.id);
		}

		if (!input.skipMemberDm) {
			await this.notifyMember(thread, input.reason);
		}

		return closed;
	}

	static async notifyMember(thread: { id: number; userId: string; dmChannelId?: string | null }, reason?: string) {
		const components = await Closed.render({ reason: reason?.trim() ?? '' });
		await this.sendComponentsToParticipants(thread.id, components);
	}

	/**
	 * Sets the scheduled close, posts notices to the staff channel + member DMs,
	 * and stores those Discord message refs so a later cancel can edit them.
	 */
	static async scheduleClose(input: {
		threadId: number;
		closesAt: Date;
		reason?: string;
		executedBy: string;
		staffChannel: TextBasedChannel;
		/** Optional existing staff notice (e.g. command reply). When omitted, posts in staffChannel. */
		staffNoticeMessage?: Message | null;
	}) {
		const components = await ScheduledCloseNotice.renderNotice({
			closesAt: input.closesAt,
			reason: input.reason
		});

		const messages: ScheduledCloseNoticeRef[] = [];

		if (input.staffNoticeMessage) {
			messages.push({
				channelId: input.staffNoticeMessage.channelId,
				messageId: input.staffNoticeMessage.id
			});
		} else if (input.staffChannel.isSendable()) {
			const sent = await input.staffChannel
				.send({
					components,
					flags: MessageFlags.IsComponentsV2,
					allowedMentions: { parse: [] }
				})
				.catch((error) => {
					container.logger.warn('Failed to post scheduled-close notice in staff channel', error);
					return null;
				});
			if (sent) {
				messages.push({ channelId: sent.channelId, messageId: sent.id });
			}
		}

		const dmRefs = await this.sendComponentsToParticipants(input.threadId, components);
		messages.push(...dmRefs);

		const reason = input.reason?.trim() || undefined;
		const durationLabel = formatCompactDuration(input.closesAt.getTime() - Date.now());

		const audit = AuditService.log({
			action: AuditAction.ThreadCloseScheduled,
			executedBy: input.executedBy,
			threadId: input.threadId,
			channelId: input.staffChannel.id,
			payload: {
				closesAt: input.closesAt.toISOString(),
				durationLabel,
				reason
			}
		});

		TicketService.setScheduledClose(input.threadId, input.closesAt, {
			closesAt: input.closesAt.getTime(),
			reason,
			auditId: audit.id,
			messages
		});

		RealtimeService.publish({ type: 'ticket.updated', ticketId: input.threadId });
		wakeAutoClose();
	}

	/**
	 * Clears a pending scheduled close and edits prior notices to the cancelled state.
	 * Returns true when a schedule was present.
	 */
	static async cancelScheduledClose(threadId: number, executedBy = 'system') {
		const notices = TicketService.clearScheduledClose(threadId);
		if (!notices) return false;

		wakeAutoClose();
		await this.finalizeScheduleCancellation(threadId, notices, executedBy);
		return true;
	}

	/** Edits Discord notices + replaces the transcript schedule marker after the DB schedule was cleared. */
	static async finalizeScheduleCancellation(
		threadId: number,
		notices: {
			closesAt: number;
			reason?: string;
			auditId?: number;
			messages: ScheduledCloseNoticeRef[];
		},
		executedBy = 'system'
	) {
		const payload = {
			closesAt: new Date(notices.closesAt).toISOString(),
			reason: notices.reason
		};

		const auditId =
			notices.auditId ??
			AuditService.findLatestForThread(threadId, AuditAction.ThreadCloseScheduled)?.id;

		if (auditId) {
			AuditService.replace(auditId, {
				action: AuditAction.ThreadCloseScheduleCancelled,
				executedBy,
				payload
			});
		} else {
			AuditService.log({
				action: AuditAction.ThreadCloseScheduleCancelled,
				executedBy,
				threadId,
				payload
			});
		}

		RealtimeService.publish({ type: 'ticket.updated', ticketId: threadId });
		await this.editNoticesCancelled(notices);
	}

	static async editNoticesCancelled(notices: {
		closesAt: number;
		reason?: string;
		messages: ScheduledCloseNoticeRef[];
	}) {
		const components = await ScheduledCloseNotice.renderCancelled({
			closesAt: new Date(notices.closesAt),
			reason: notices.reason
		});

		await Promise.all(
			notices.messages.map(async (ref) => {
				const channel = await container.client.channels.fetch(ref.channelId).catch(() => null);
				if (!channel || !('messages' in channel)) return;

				await channel.messages
					.edit(ref.messageId, {
						components,
						flags: MessageFlags.IsComponentsV2,
						allowedMentions: { parse: [] }
					})
					.catch((error) => {
						container.logger.warn(
							`Failed to edit scheduled-close notice ${ref.messageId} in ${ref.channelId}`,
							error
						);
					});
			})
		);
	}

	private static async sendComponentsToParticipants(
		threadId: number,
		components: APIMessageTopLevelComponent[]
	): Promise<ScheduledCloseNoticeRef[]> {
		const refs: ScheduledCloseNoticeRef[] = [];
		const participants = TicketService.listUserParticipants(threadId);

		for (const participant of participants) {
			const dmChannel = await TicketChannelService.resolveParticipantDmChannel(participant, threadId);
			if (!dmChannel?.isDMBased() || !dmChannel.isSendable()) continue;

			const sent = await dmChannel
				.send({
					components,
					flags: MessageFlags.IsComponentsV2,
					allowedMentions: { parse: [] }
				})
				.catch(async (error) => {
					logDmSendFailure(`Failed to DM scheduled-close notice for thread ${threadId}`, error);
					await ParticipantDmStatusService.noteUnreachable(threadId, participant.userId, { error });
					return null;
				});

			if (sent) {
				await ParticipantDmStatusService.noteReachable(threadId, participant.userId);
				refs.push({ channelId: sent.channelId, messageId: sent.id });
			}
		}

		return refs;
	}
}
