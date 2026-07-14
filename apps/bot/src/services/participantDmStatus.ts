import { MemberDmsClosed } from '@/lib/components/memberDmsClosed';
import { MemberDmsOpen } from '@/lib/components/memberDmsOpen';
import { isUnreachableDmError } from '@/lib/discord/dmErrors';
import { TRANSCRIPT_SYSTEM_AUTHOR_ID } from '@/lib/transcript/systemMessage';
import { AuditAction, AuditService } from '@/services/audit';
import { DiscordChannelService } from '@/services/discordChannel';
import { RealtimeService } from '@/services/realtime';
import { TicketService } from '@/services/ticket';
import { container } from '@sapphire/framework';
import type { User } from 'discord.js';
import type { DbClient } from './types';

type DmStatusKind = 'closed' | 'open';

export type ParticipantDmNoticeOptions = {
	user?: User;
	error?: unknown;
	db?: DbClient;
	/**
	 * When true, post the Discord staff-channel notice but skip the transcript
	 * audit marker (e.g. add flow already wrote `participant.added` with
	 * `dmUnreachable`).
	 */
	skipTranscript?: boolean;
};

/**
 * Tracks whether ticket member participants can receive bot DMs.
 * Transitions post a short staff-channel Components V2 notice (pinging the
 * member) and a timeline audit marker — never a System transcript message.
 */
export abstract class ParticipantDmStatusService {
	/**
	 * Call after a successful outbound DM. If the participant was marked
	 * unreachable, posts the "DMs available" notice + audit before the caller
	 * records the delivered message in the transcript.
	 */
	static async noteReachable(
		threadId: number,
		userId: string,
		options: ParticipantDmNoticeOptions = {}
	) {
		const db = options.db ?? container.sqlite;
		const participant = TicketService.getUserParticipant(threadId, userId, db);
		if (!participant?.dmUnreachable) return false;

		TicketService.setParticipantDmUnreachable(threadId, userId, false, db);
		await this.postNotice(threadId, userId, 'open', options);
		return true;
	}

	/**
	 * Call when Discord rejects a DM as unreachable. Posts the closed notice
	 * on the first transition only.
	 */
	static async noteUnreachable(
		threadId: number,
		userId: string,
		options: ParticipantDmNoticeOptions = {}
	) {
		if (options.error != null && !isUnreachableDmError(options.error)) return false;

		const db = options.db ?? container.sqlite;
		const participant = TicketService.getUserParticipant(threadId, userId, db);
		if (!participant) return false;
		if (participant.dmUnreachable) return false;

		TicketService.setParticipantDmUnreachable(threadId, userId, true, db);
		await this.postNotice(threadId, userId, 'closed', options);
		return true;
	}

	/** Convenience for send attempt results. */
	static async trackSendResult(
		threadId: number,
		userId: string,
		result: { ok: true; user?: User } | { ok: false; error: unknown; user?: User },
		db: DbClient = container.sqlite
	) {
		if (result.ok) {
			return this.noteReachable(threadId, userId, { user: result.user, db });
		}
		return this.noteUnreachable(threadId, userId, { user: result.user, error: result.error, db });
	}

	private static async postNotice(
		threadId: number,
		userId: string,
		kind: DmStatusKind,
		options: ParticipantDmNoticeOptions
	) {
		const db = options.db ?? container.sqlite;
		const thread = TicketService.findById(threadId, db);
		if (!thread?.channelId) return;

		const userMention = `<@${userId}>`;
		const components =
			kind === 'closed'
				? await MemberDmsClosed.render({ userMention })
				: await MemberDmsOpen.render({ userMention });

		await DiscordChannelService.sendComponents(thread.channelId, components, {
			allowedMentions: { users: [userId] }
		}).catch((error) => {
			container.logger.warn(
				`Failed to post member-dms-${kind} notice for ticket ${threadId}`,
				error
			);
			return null;
		});

		if (options.skipTranscript) return;

		AuditService.log(
			{
				action:
					kind === 'closed'
						? AuditAction.ParticipantDmsUnavailable
						: AuditAction.ParticipantDmsAvailable,
				executedBy: TRANSCRIPT_SYSTEM_AUTHOR_ID,
				threadId,
				userId,
				channelId: thread.channelId,
				payload: { userId }
			},
			db
		);
		RealtimeService.publish({ type: 'ticket.updated', ticketId: threadId });
	}
}
