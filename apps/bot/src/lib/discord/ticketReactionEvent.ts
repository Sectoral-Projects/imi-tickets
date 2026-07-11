import { shouldRelayStaffTicketActivity } from '@/lib/discord/ticketRelay';
import type { StoredReactionEmoji } from '@/lib/discord/reactionEmoji';
import { MessageService } from '@/services/message';
import { TicketService, ThreadStatus } from '@/services/ticket';
import { container } from '@sapphire/framework';
import type { APIEmoji, Message, MessageReaction, PartialMessageReaction, User } from 'discord.js';

export type ResolvedTicketReactionEvent = {
	thread: NonNullable<ReturnType<typeof TicketService.findById>>;
	stored: NonNullable<ReturnType<typeof MessageService.findLogicalMessageByDiscordId>>;
	message: Message;
	reaction: MessageReaction;
	shouldMirror: boolean;
};

export type TicketReactionPacket = {
	user_id?: string;
	message_id?: string;
	channel_id?: string;
	guild_id?: string;
	emoji?: APIEmoji;
};

export type ResolvedTicketReactionPacket = {
	thread: NonNullable<ReturnType<typeof TicketService.findById>>;
	stored: NonNullable<ReturnType<typeof MessageService.findLogicalMessageByDiscordId>>;
	userId: string;
	channelId: string;
	discordMessageId: string;
	guildId: string | undefined;
	emoji: StoredReactionEmoji;
	shouldMirror: boolean;
};

/**
 * Partials must not abort the handler. Partial Message/Reaction still expose
 * snowflake ids; fetch is best-effort hydration only.
 */
async function hydrateReaction(reaction: MessageReaction | PartialMessageReaction) {
	if (reaction.partial) {
		await reaction.fetch().catch((error) => {
			container.logger.warn('Could not fully fetch reaction for ticket transcript', error);
		});
	}

	const message = reaction.message;
	if (message.partial) {
		await message.fetch().catch((error) => {
			container.logger.warn('Could not fully fetch reaction message for ticket transcript', error);
		});
	}

	return reaction as MessageReaction;
}

function emojiFromPacket(emoji: APIEmoji): StoredReactionEmoji | null {
	if (!emoji.name && !emoji.id) return null;

	return {
		name: emoji.name ?? 'emoji',
		id: emoji.id ? String(emoji.id) : null,
		animated: Boolean(emoji.animated)
	};
}

/**
 * Resolve a human reaction from a gateway packet.
 *
 * Staff ticket channels are often forum threads. discord.js silently drops
 * `messageReactionAdd` when that thread is not in cache (no channel `type` on
 * the packet → createChannel returns null). Raw packets still carry the
 * snowflakes we need to record against SQLite.
 */
export async function resolveTicketReactionPacket(
	packet: TicketReactionPacket
): Promise<ResolvedTicketReactionPacket | null> {
	const userId = packet.user_id;
	const discordMessageId = packet.message_id;
	const channelId = packet.channel_id;
	const botId = container.client.user?.id;

	if (!userId || !discordMessageId || !channelId) return null;
	if (botId && userId === botId) return null;
	if (!packet.emoji) return null;

	const emoji = emojiFromPacket(packet.emoji);
	if (!emoji) return null;

	const stored = MessageService.findLogicalMessageByDiscordId(discordMessageId);
	if (!stored) return null;

	const thread = TicketService.findById(stored.threadId);
	if (!thread || thread.status !== ThreadStatus.Open || thread.deletedAt) return null;

	const inStaffChannel = Boolean(thread.channelId && channelId === String(thread.channelId));
	const shouldMirror = inStaffChannel
		? await shouldRelayStaffTicketActivity(userId, thread.userId, packet.guild_id)
		: true;

	return {
		thread,
		stored,
		userId,
		channelId,
		discordMessageId,
		guildId: packet.guild_id,
		emoji,
		shouldMirror
	};
}

/**
 * Resolve a human reaction onto a stored ticket message.
 * Source of truth for "which message" is the Discord message/relay id in SQLite,
 * not channel-id matching (that dropped staff-side reactions).
 *
 * Prefer {@link resolveTicketReactionPacket} for gateway handling — this path
 * still depends on discord.js constructing channel/message objects.
 */
export async function resolveTicketReactionEvent(
	reaction: MessageReaction | PartialMessageReaction,
	user: User
): Promise<ResolvedTicketReactionEvent | null> {
	if (user.bot) return null;

	const resolvedReaction = await hydrateReaction(reaction);
	const message = resolvedReaction.message as Message;
	const discordMessageId = String(message.id);
	if (!discordMessageId) return null;

	const stored = MessageService.findLogicalMessageByDiscordId(discordMessageId);
	if (!stored) return null;

	const thread = TicketService.findById(stored.threadId);
	if (!thread || thread.status !== ThreadStatus.Open || thread.deletedAt) return null;

	const channelId = String(message.channelId ?? '');
	const inStaffChannel = Boolean(thread.channelId && channelId === String(thread.channelId));
	const shouldMirror = inStaffChannel
		? await shouldRelayStaffTicketActivity(user.id, thread.userId, message.guildId)
		: true;

	return {
		thread,
		stored,
		message,
		reaction: resolvedReaction,
		shouldMirror
	};
}

export function resolveReactionMirrorTargets(
	message: Message,
	thread: ResolvedTicketReactionEvent['thread']
) {
	return MessageService.resolveRelayReactionTargets(String(message.id), String(message.channelId), thread);
}

export function resolveReactionMirrorTargetsFromPacket(
	discordMessageId: string,
	channelId: string,
	thread: ResolvedTicketReactionPacket['thread']
) {
	return MessageService.resolveRelayReactionTargets(discordMessageId, channelId, thread);
}

/** Best-effort fetch of the Discord message that was reacted to (for mirror-remove). */
export async function fetchReactionSourceMessage(channelId: string, messageId: string) {
	const channel = await container.client.channels.fetch(channelId).catch(() => null);
	if (!channel?.isTextBased()) return null;

	return channel.messages.fetch(messageId).catch(() => null);
}
