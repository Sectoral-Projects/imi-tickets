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
 * Handle MESSAGE_REACTION_ADD via Raw, not Events.MessageReactionAdd.
 *
 * discord.js drops messageReactionAdd when the reacted channel is an uncached
 * forum/thread (staff tickets): the gateway packet has no channel type, so
 * createChannel returns null and the action aborts before emit. Raw still
 * receives every dispatch with the snowflakes we need.
 */
@ApplyOptions<Listener.Options>({
	name: 'messageReactionAdd',
	event: Events.Raw
})
export class MessageReactionAddEvent extends Listener {
	public override async run(packet: { t?: string; d?: TicketReactionPacket }) {
		if (packet.t !== 'MESSAGE_REACTION_ADD') return;

		const event = await resolveTicketReactionPacket(packet.d ?? {});
		if (!event) return;

		const { thread, stored, userId, channelId, discordMessageId, emoji, shouldMirror } = event;

		MessageReactionService.add(
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
				await TicketChannelService.mirrorReactionToLinkedMessages(emoji, targets);
			}
		}

		// After mirroring, scan every linked Discord copy and upsert humans.
		// This picks up reactors whose events were dropped without using
		// Discord's bot-collapsed count as truth.
		await MessageReactionService.ingestHumansFromLinkedCopies(stored, thread, emoji);

		RealtimeService.publish({
			type: 'message.updated',
			ticketId: thread.id,
			messageId: stored.id
		});

		// Keep the source message in cache when possible so later discord.js
		// paths (and mirror-remove) have a warmer channel/message.
		void fetchReactionSourceMessage(channelId, discordMessageId);
	}
}
