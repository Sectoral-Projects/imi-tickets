import {
	fetchReactionSourceMessage,
	resolveReactionMirrorTargetsFromPacket,
	resolveTicketReactionPacket,
	type TicketReactionPacket
} from '@/lib/discord/ticketReactionEvent';
import { MessageReactionService } from '@/services/messageReaction';
import { RealtimeService } from '@/services/realtime';
import { TicketChannelService } from '@/services/ticketChannel';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';

/**
 * Handle MESSAGE_REACTION_REMOVE via Raw — same uncached forum/thread issue as add.
 */
@ApplyOptions<Listener.Options>({
	name: 'messageReactionRemove',
	event: Events.Raw
})
export class MessageReactionRemoveEvent extends Listener {
	public override async run(packet: { t?: string; d?: TicketReactionPacket }) {
		if (packet.t !== 'MESSAGE_REACTION_REMOVE') return;

		const event = await resolveTicketReactionPacket(packet.d ?? {});
		if (!event) return;

		const { thread, stored, userId, channelId, discordMessageId, emoji, shouldMirror } = event;

		MessageReactionService.remove(
			{
				messageId: stored.id,
				threadId: thread.id,
				userId,
				emoji
			},
			undefined,
			{ publish: false }
		);

		if (shouldMirror) {
			const targets = resolveReactionMirrorTargetsFromPacket(discordMessageId, channelId, thread);
			if (targets.length > 0) {
				const sourceMessage = await fetchReactionSourceMessage(channelId, discordMessageId);
				if (sourceMessage) {
					await TicketChannelService.mirrorReactionRemoveFromLinkedMessages(emoji, sourceMessage, targets);
				}
			}
		}

		await MessageReactionService.ingestHumansFromLinkedCopies(stored, thread, emoji);

		RealtimeService.publish({
			type: 'message.updated',
			ticketId: thread.id,
			messageId: stored.id
		});
	}
}
