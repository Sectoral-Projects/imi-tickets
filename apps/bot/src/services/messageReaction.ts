import { messageReactions, messages } from '@/database/sqlite/schema';
import {
	reactionEmojiKey,
	reactionEmojiMatches,
	type StoredReactionEmoji
} from '@/lib/discord/reactionEmoji';
import { container } from '@sapphire/framework';
import { and, eq, inArray } from 'drizzle-orm';
import type { APIEmoji, Emoji } from 'discord.js';
import { MessageService } from './message';
import { RealtimeService } from './realtime';
import type { DbClient } from './types';

export type MessageReactionSummary = {
	emoji: {
		name: string;
		id: string | null;
		animated: boolean;
	};
	count: number;
	userIds: string[];
};

type AggregatedReaction = MessageReactionSummary & {
	firstReactionAt: number;
};

function normalizeEmoji(emoji: Emoji | APIEmoji | StoredReactionEmoji): StoredReactionEmoji {
	return {
		name: emoji.name ?? 'emoji',
		id: 'id' in emoji && emoji.id ? String(emoji.id) : null,
		animated: 'animated' in emoji ? Boolean(emoji.animated) : false
	};
}

/**
 * Transcript reactions are per-human rows on the logical message.
 * Discord can only mirror one bot reaction per emoji on the linked copy, so
 * counts must come from DB rows (and optional Discord human scans), never from
 * a single Discord message's reaction count.
 */
export abstract class MessageReactionService {
	static add(
		input: {
			messageId: number;
			threadId: number;
			userId: string;
			emoji: Emoji | APIEmoji | StoredReactionEmoji;
		},
		db: DbClient = container.sqlite,
		options: { publish?: boolean } = {}
	) {
		const parsed = normalizeEmoji(input.emoji);
		const key = reactionEmojiKey(parsed);
		const now = new Date();

		const result = db
			.insert(messageReactions)
			.values({
				messageId: input.messageId,
				userId: input.userId,
				emojiName: parsed.name,
				emojiId: parsed.id,
				emojiKey: key,
				isAnimated: parsed.animated,
				createdAt: now
			})
			.onConflictDoNothing()
			.run();

		if (options.publish !== false && result.changes > 0) {
			RealtimeService.publish({
				type: 'message.updated',
				ticketId: input.threadId,
				messageId: input.messageId
			});
		}

		return result.changes > 0;
	}

	static remove(
		input: {
			messageId: number;
			threadId: number;
			userId: string;
			emoji: Emoji | APIEmoji | StoredReactionEmoji;
		},
		db: DbClient = container.sqlite,
		options: { publish?: boolean } = {}
	) {
		const parsed = normalizeEmoji(input.emoji);
		const key = reactionEmojiKey(parsed);

		const result = db
			.delete(messageReactions)
			.where(
				and(
					eq(messageReactions.messageId, input.messageId),
					eq(messageReactions.userId, input.userId),
					eq(messageReactions.emojiKey, key)
				)
			)
			.run();

		if (options.publish !== false && result.changes > 0) {
			RealtimeService.publish({
				type: 'message.updated',
				ticketId: input.threadId,
				messageId: input.messageId
			});
		}

		return result.changes > 0;
	}

	/** True when at least one human still has this emoji on the logical message. */
	static hasRemainingReactors(
		messageId: number,
		emoji: Emoji | APIEmoji | StoredReactionEmoji,
		db: DbClient = container.sqlite
	) {
		const key = reactionEmojiKey(normalizeEmoji(emoji));
		const row = db
			.select({ userId: messageReactions.userId })
			.from(messageReactions)
			.where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.emojiKey, key)))
			.limit(1)
			.get();

		return Boolean(row);
	}

	/**
	 * Upsert every non-bot reactor found on any linked Discord copy.
	 * Never deletes — event-sourced removes own that. This heals missed events
	 * without collapsing counts to Discord's bot-mirrored total.
	 */
	static async ingestHumansFromLinkedCopies(
		logical: typeof messages.$inferSelect,
		thread: { id: number },
		emoji: Emoji | APIEmoji | StoredReactionEmoji,
		db: DbClient = container.sqlite
	) {
		const parsed = normalizeEmoji(emoji);
		const botId = container.client.user?.id;
		let inserted = 0;

		for (const physical of MessageService.listPhysicalDiscordMessages(logical, db)) {
			const userIds = await this.listHumanReactorsOnCopy(
				physical.channelId,
				physical.messageId,
				parsed,
				botId
			);

			for (const userId of userIds) {
				const changed = this.add(
					{
						messageId: logical.id,
						threadId: thread.id,
						userId,
						emoji: parsed
					},
					db,
					{ publish: false }
				);
				if (changed) inserted += 1;
			}
		}

		if (inserted > 0) {
			RealtimeService.publish({
				type: 'message.updated',
				ticketId: thread.id,
				messageId: logical.id
			});
		}

		return inserted;
	}

	private static async listHumanReactorsOnCopy(
		channelId: string,
		messageId: string,
		emoji: StoredReactionEmoji,
		botId: string | undefined
	) {
		const channel = await container.client.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased()) return [];

		const discordMessage = await channel.messages.fetch(messageId).catch(() => null);
		if (!discordMessage) return [];

		const reactionIdentifier = emoji.id ?? emoji.name;
		if (!reactionIdentifier) return [];

		for (const [, partialReaction] of discordMessage.reactions.cache) {
			if (partialReaction.partial) {
				await partialReaction.fetch().catch(() => undefined);
			}
		}

		const match =
			discordMessage.reactions.resolve(reactionIdentifier) ??
			discordMessage.reactions.cache.find((reaction) => reactionEmojiMatches(reaction.emoji, emoji));

		if (!match) return [];

		const users = await match.users.fetch().catch(() => null);
		if (!users) return [];

		const userIds: string[] = [];
		for (const [, reactor] of users) {
			if (botId && reactor.id === botId) continue;
			userIds.push(reactor.id);
		}

		return userIds;
	}

	static listByMessageIds(messageIds: number[], db: DbClient = container.sqlite) {
		if (messageIds.length === 0) return [];

		return db
			.select()
			.from(messageReactions)
			.where(inArray(messageReactions.messageId, messageIds))
			.all();
	}

	static aggregateByMessage(messageIds: number[], db: DbClient = container.sqlite) {
		const rows = this.listByMessageIds(messageIds, db);
		const map = new Map<number, AggregatedReaction[]>();

		for (const row of rows) {
			const list = map.get(row.messageId) ?? [];
			const emoji = {
				name: row.emojiName,
				id: row.emojiId,
				animated: row.isAnimated
			};
			const key = row.emojiKey;
			const reactionAt = row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt);
			const existing = list.find((entry) => reactionEmojiKey(entry.emoji) === key);

			if (existing) {
				if (!existing.userIds.includes(row.userId)) {
					existing.userIds.push(row.userId);
				}
				existing.count = existing.userIds.length;
				existing.firstReactionAt = Math.min(existing.firstReactionAt, reactionAt);
			} else {
				list.push({
					emoji,
					count: 1,
					userIds: [row.userId],
					firstReactionAt: reactionAt
				});
			}

			map.set(row.messageId, list);
		}

		const summaries = new Map<number, MessageReactionSummary[]>();

		for (const [messageId, reactions] of map) {
			reactions.sort(
				(left, right) =>
					left.firstReactionAt - right.firstReactionAt ||
					left.emoji.name.localeCompare(right.emoji.name)
			);
			summaries.set(
				messageId,
				reactions.map(({ emoji, count, userIds }) => ({ emoji, count, userIds }))
			);
		}

		return summaries;
	}
}
