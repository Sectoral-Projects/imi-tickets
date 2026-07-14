import { StaffContact } from '@/lib/components/staffContact';
import { isUnreachableDmError, logDmSendFailure } from '@/lib/discord/dmErrors';
import { OutboundDmGuard } from '@/lib/discord/outboundDmGuard';
import { BlockService } from '@/services/block';
import { AuditAction, AuditService } from '@/services/audit';
import { ParticipantDmStatusService } from '@/services/participantDmStatus';
import { RealtimeService } from '@/services/realtime';
import { TicketChannelService } from '@/services/ticketChannel';
import { ParticipantRole, TicketService, ThreadStatus } from '@/services/ticket';
import { container } from '@sapphire/framework';
import { MessageFlags, type User } from 'discord.js';
import type { DbClient } from './types';

export abstract class TicketParticipantService {
	static async addUserToOpenTicket(
		threadId: number,
		user: User,
		executedBy: string,
		db: DbClient = container.sqlite
	) {
		const thread = TicketService.findById(threadId, db);
		if (!thread || thread.status !== ThreadStatus.Open) {
			throw new Error('Open this ticket channel first.');
		}
		if (!thread.channelId) {
			throw new Error('This ticket has no staff channel yet.');
		}

		if (TicketService.isUserParticipant(threadId, user.id, db)) {
			throw new Error('That member is already on this ticket.');
		}

		const block = await BlockService.findBlockForUser(user.id);
		if (block) {
			throw new Error('That member is blocked from tickets.');
		}

		const dmChannel = await user.createDM().catch((error) => {
			if (isUnreachableDmError(error)) return null;
			throw error;
		});
		if (!dmChannel) {
			throw new Error(`Could not open a DM with ${user.tag}.`);
		}

		TicketService.addParticipant(threadId, user.id, ParticipantRole.User, { dmChannelId: dmChannel.id }, db);

		let dmUnreachable = false;
		OutboundDmGuard.mark(dmChannel.id);
		try {
			await dmChannel.send({
				components: await StaffContact.render(),
				flags: [MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			logDmSendFailure(`Failed to notify ${user.tag} about ticket add`, error);
			if (isUnreachableDmError(error)) {
				dmUnreachable = true;
			}
		} finally {
			OutboundDmGuard.unmark(dmChannel.id);
		}

		// Audit marker first so it sorts above the staff open-profile transcript row.
		AuditService.log({
			action: AuditAction.ParticipantAdded,
			executedBy,
			threadId,
			userId: user.id,
			payload: { userId: user.id, dmUnreachable }
		});

		await TicketChannelService.postStaffOpenProfile(
			{ id: thread.id, channelId: thread.channelId },
			user,
			{ headingPrefix: 'User added', executedBy },
			db
		);

		if (dmUnreachable) {
			await ParticipantDmStatusService.noteUnreachable(threadId, user.id, {
				user,
				skipTranscript: true,
				db
			});
		}

		RealtimeService.publish({ type: 'ticket.updated', ticketId: threadId });

		return { thread, dmChannelId: dmChannel.id };
	}

	static removeUserFromOpenTicket(threadId: number, userId: string, executedBy: string, db: DbClient = container.sqlite) {
		const thread = TicketService.findById(threadId, db);
		if (!thread || thread.status !== ThreadStatus.Open) {
			throw new Error('Open this ticket channel first.');
		}

		return TicketService.removeParticipant(threadId, userId, executedBy, db);
	}

	/** Record that staff used a command or spoke in an open ticket channel/post. */
	static noteStaffActivityInChannel(channelId: string | null | undefined, userId: string, db: DbClient = container.sqlite) {
		if (!channelId) return false;
		const thread = TicketService.findOpenByStaffChannelId(channelId, db);
		if (!thread) return false;
		return TicketService.ensureStaffParticipant(thread.id, userId, db);
	}
}
