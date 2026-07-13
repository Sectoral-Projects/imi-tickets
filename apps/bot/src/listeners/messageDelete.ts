import { shouldRelayStaffTicketActivity } from '@/lib/discord/ticketRelay';
import { MessageService } from '@/services/message';
import { RealtimeService } from '@/services/realtime';
import { TicketChannelService } from '@/services/ticketChannel';
import { TicketService, ThreadStatus } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, type Message, type PartialMessage } from 'discord.js';

@ApplyOptions<Listener.Options>({
	name: 'messageDelete',
	event: Events.MessageDelete
})
export class MessageDeleteEvent extends Listener {
	public override async run(message: Message | PartialMessage) {
		if (message.author?.bot) return;

		const stored = MessageService.findStoredMessageByDiscordId(message.id);
		if (!stored || stored.deletedAt) return;

		const thread = TicketService.findById(stored.threadId);
		if (!thread || thread.status !== ThreadStatus.Open) return;

		if (message.guildId) {
			const authorId = message.author?.id ?? stored.authorId;
			const shouldRelay = await shouldRelayStaffTicketActivity(authorId, thread.userId, message.guildId);
			if (!shouldRelay) return;
		} else if (message.channel && 'type' in message.channel && message.channel.type !== ChannelType.DM) {
			return;
		}

		const deleted = MessageService.softDelete(stored.id, message.author?.id ?? stored.authorId);
		if (!deleted) return;

		RealtimeService.publish({
			type: 'message.updated',
			ticketId: deleted.threadId,
			messageId: deleted.id
		});

		if (stored.isPrivateStaff) return;

		await TicketChannelService.syncMessageDeleted(
			{ ...stored, ...deleted },
			thread,
			message.id
		);
	}
}
