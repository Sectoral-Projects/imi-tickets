import { Closed } from '@/lib/components/closed';
import { TicketChannelService } from './ticketChannel';
import { TicketService, ThreadStatus, type CloseThreadInput } from './ticket';
import { MessageFlags } from 'discord.js';

export type CloseTicketInput = CloseThreadInput & {
	/** Skip the member DM when the close notice is shown in the same channel (user DM close). */
	skipMemberDm?: boolean;
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
		const participants = TicketService.listUserParticipants(thread.id);

		for (const participant of participants) {
			const dmChannel = await TicketChannelService.resolveParticipantDmChannel(participant, thread.id);
			if (!dmChannel?.isDMBased()) continue;

			await dmChannel.send({
				components,
				flags: MessageFlags.IsComponentsV2
			});
		}
	}
}
