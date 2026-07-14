import { attachments, memberSnapshots, messageRevisions, messages } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { MessageReferenceType, MessageType, type Message } from 'discord.js';
import { AuditAction, AuditService } from './audit';
import { AutoCloseService } from './autoClose';
import { MessageRelayService } from './messageRelay';
import { MessageReactionService, type MessageReactionSummary } from './messageReaction';
import { RealtimeService } from './realtime';
import { TicketCloseService } from './ticketClose';
import { TicketService } from './ticket';
import { TRANSCRIPT_SYSTEM_AUTHOR_ID } from '@/lib/transcript/systemMessage';
import type { DbClient } from './types';

export interface CreateMessageInput {
	threadId: number;
	channelId: string;
	authorId: string;
	messageId: string;
	relayMessageId?: string;
	memberSnapshotId?: number;
	content: string;
	isForwarded?: boolean;
	isPrivateStaff?: boolean;
	/** Staff template command invocation including prefix (e.g. `;faq`). */
	staffCommand?: string | null;
	replyToMessageId?: number;
	/** Defaults to `authorId` — override for system/staff-initiated writes. */
	executedBy?: string;
}

export interface EditMessageInput {
	id: number;
	content: string;
	executedBy: string;
}

export interface ListMessagesInput {
	threadId: number;
	/** Row offset — pass back `nextCursor` from the previous page. */
	cursor?: number;
	/** Defaults to 30. */
	limit?: number;
	includeDeleted?: boolean;
}

export type MessageReplyPreview = {
	id: number;
	authorId: string;
	authorName: string | null;
	authorAvatar: string | null;
	content: string;
	deletedAt: Date | null;
};

export type EnrichedMessage = typeof messages.$inferSelect & {
	author: typeof memberSnapshots.$inferSelect | null;
	attachments: (typeof attachments.$inferSelect)[];
	editHistory: MessageRevisionSnapshot[];
	reactions: MessageReactionSummary[];
	replyTo: MessageReplyPreview | null;
};

export type MessageRevisionSnapshot = {
	revision: number;
	content: string;
	editedAt: Date;
};

export interface ListMessagesResult {
	messages: EnrichedMessage[];
	nextCursor: number | null;
}

export abstract class MessageService {
	/**
	 * Records a message, bumps the parent thread's `lastMessageAt`, and
	 * writes an audit log entry — atomically.
	 */
	static create(data: CreateMessageInput) {
		const existing = container.sqlite.select().from(messages).where(eq(messages.messageId, data.messageId)).get();
		if (existing) return existing;

		let cancelledNotices: ReturnType<typeof TicketService.clearScheduledClose> = null;

		const message = container.sqlite.transaction((tx) => {
			const created = tx
				.insert(messages)
				.values({
					threadId: data.threadId,
					channelId: data.channelId,
					authorId: data.authorId,
					messageId: data.messageId,
					relayMessageId: data.relayMessageId,
					memberSnapshotId: data.memberSnapshotId,
					content: data.content,
					isForwarded: data.isForwarded ?? false,
					isPrivateStaff: data.isPrivateStaff ?? false,
					staffCommand: data.staffCommand?.trim() || null,
					replyToMessageId: data.replyToMessageId,
					createdAt: new Date()
				})
				.returning()
				.get();

			TicketService.touchLastMessageAt(data.threadId, tx);
			// System transcript notices must not cancel a staff-scheduled close.
			if (data.authorId !== TRANSCRIPT_SYSTEM_AUTHOR_ID) {
				cancelledNotices = TicketService.clearScheduledClose(data.threadId, tx);
			}

			AuditService.log(
				{
					action: AuditAction.MessageCreated,
					executedBy: data.executedBy ?? data.authorId,
					threadId: data.threadId,
					messageId: data.messageId,
					userId: data.authorId,
					channelId: data.channelId
				},
				tx
			);

			return created;
		});

		AutoCloseService.wake();

		if (cancelledNotices) {
			void TicketCloseService.finalizeScheduleCancellation(
				data.threadId,
				cancelledNotices,
				data.executedBy ?? data.authorId
			);
		}

		RealtimeService.publish({
			type: 'message.created',
			ticketId: data.threadId,
			messageId: message.id
		});

		return message;
	}

	/** Edits a message's content, bumping its revision counter. */
	static edit(data: EditMessageInput) {
		const updated = container.sqlite.transaction((tx) => {
			const existing = tx.select().from(messages).where(eq(messages.id, data.id)).get();
			if (!existing) return null;
			if (existing.content === data.content) return existing;

			tx.insert(messageRevisions)
				.values({
					messageId: existing.id,
					revision: existing.revision,
					content: existing.content,
					editedAt: new Date()
				})
				.run();

			const row = tx
				.update(messages)
				.set({
					content: data.content,
					revision: existing.revision + 1,
					updatedAt: new Date()
				})
				.where(eq(messages.id, data.id))
				.returning()
				.get();

			AuditService.log(
				{
					action: AuditAction.MessageUpdated,
					executedBy: data.executedBy,
					threadId: existing.threadId,
					messageId: existing.messageId,
					payload: { previousContent: existing.content, newContent: data.content, revision: row.revision }
				},
				tx
			);

			return row;
		});

		if (updated) {
			RealtimeService.publish({
				type: 'message.updated',
				ticketId: updated.threadId,
				messageId: updated.id
			});
		}

		return updated;
	}

	static setRelayMessageId(id: number, relayMessageId: string, db: DbClient = container.sqlite) {
		return db.update(messages).set({ relayMessageId }).where(eq(messages.id, id)).run();
	}

	static softDelete(id: number, executedBy: string) {
		return container.sqlite.transaction((tx) => {
			const existing = tx.select().from(messages).where(eq(messages.id, id)).get();
			if (!existing) return null;
			if (existing.deletedAt) return existing;

			const deleted = tx.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, id)).returning().get();

			AuditService.log(
				{
					action: AuditAction.MessageDeleted,
					executedBy,
					threadId: existing.threadId,
					messageId: existing.messageId
				},
				tx
			);

			return deleted;
		});
	}

	static findById(id: number, db: DbClient = container.sqlite) {
		return db.select().from(messages).where(eq(messages.id, id)).get();
	}

	static findByDiscordMessageId(discordMessageId: string, db: DbClient = container.sqlite) {
		return db.select().from(messages).where(eq(messages.messageId, discordMessageId)).get();
	}

	static findStoredMessageByDiscordId(discordMessageId: string, db: DbClient = container.sqlite) {
		return this.findByDiscordMessageId(discordMessageId, db) ?? this.findLogicalMessageByDiscordId(discordMessageId, db);
	}

	static findLogicalMessageByDiscordId(discordMessageId: string, db: DbClient = container.sqlite) {
		return this.findLogicalMessage(discordMessageId, db);
	}

	/** Maps a Discord reply reference to the stored logical message id in a thread. */
	static resolveReplyMessageId(
		referencedDiscordId: string | null | undefined,
		threadId: number,
		db: DbClient = container.sqlite
	) {
		if (!referencedDiscordId) return undefined;

		const row = this.findLogicalMessage(referencedDiscordId, db);
		if (!row || row.threadId !== threadId) return undefined;

		return row.id;
	}

	static getReferencedDiscordMessageId(message: Message): string | undefined {
		if (message.reference?.type === MessageReferenceType.Forward) return undefined;
		const messageId = message.reference?.messageId?.trim();
		return messageId || undefined;
	}

	/**
	 * Hydrates reply metadata when the gateway omits `reference.messageId`, then
	 * maps it to the stored logical message id for this thread.
	 */
	static async resolveReplyMessageIdFromDiscordMessage(
		message: Message,
		threadId: number,
		db: DbClient = container.sqlite
	): Promise<number | undefined> {
		if (message.reference?.type === MessageReferenceType.Forward) return undefined;

		let referencedDiscordId = this.getReferencedDiscordMessageId(message);
		const looksLikeReply = message.type === MessageType.Reply || message.reference != null;

		if (!referencedDiscordId && looksLikeReply) {
			const fetched = await message.fetch().catch(() => message);
			referencedDiscordId = this.getReferencedDiscordMessageId(fetched);

			if (!referencedDiscordId) {
				const referenced = await fetched.fetchReference().catch(() => null);
				referencedDiscordId = referenced?.id;
			}
		}

		return this.resolveReplyMessageId(referencedDiscordId, threadId, db);
	}

	/**
	 * Maps a Discord reply reference on the source channel to the message id
	 * the bot should reply to when relaying into the target channel.
	 */
	static resolveRelayReplyTarget(
		referencedDiscordId: string,
		sourceChannelId: string,
		targetChannelId: string,
		db: DbClient = container.sqlite
	): string | undefined {
		const row = this.findLogicalMessage(referencedDiscordId, db);
		if (!row) return undefined;

		if (referencedDiscordId === row.messageId && row.channelId === sourceChannelId) {
			return this.getRelayDiscordIdForTarget(row, targetChannelId, db);
		}

		if (this.isRelayOnChannel(row, sourceChannelId, referencedDiscordId, db)) {
			if (row.channelId === targetChannelId) {
				return row.messageId;
			}
			return this.getRelayDiscordIdForTarget(row, targetChannelId, db);
		}

		return undefined;
	}

	private static findLogicalMessage(discordMessageId: string, db: DbClient) {
		const bySource = db.select().from(messages).where(eq(messages.messageId, discordMessageId)).get();
		if (bySource) return bySource;

		const byPrimaryRelay = db.select().from(messages).where(eq(messages.relayMessageId, discordMessageId)).get();
		if (byPrimaryRelay) return byPrimaryRelay;

		const relayRow = MessageRelayService.findByRelayMessageId(discordMessageId, db);
		if (!relayRow) return undefined;

		return db.select().from(messages).where(eq(messages.id, relayRow.messageId)).get();
	}

	private static getRelayDiscordIdForTarget(
		row: typeof messages.$inferSelect,
		targetChannelId: string,
		db: DbClient
	) {
		const relays = MessageRelayService.listByMessage(row.id, db);
		const match = relays.find((relay) => relay.targetChannelId === targetChannelId);
		if (match) return match.relayMessageId;

		if (row.relayMessageId && row.channelId !== targetChannelId) {
			return row.relayMessageId;
		}

		return undefined;
	}

	private static isRelayOnChannel(
		row: typeof messages.$inferSelect,
		channelId: string,
		discordMessageId: string,
		db: DbClient
	) {
		if (row.relayMessageId === discordMessageId && row.channelId !== channelId) {
			return true;
		}

		return MessageRelayService.listByMessage(row.id, db).some(
			(relay) => relay.targetChannelId === channelId && relay.relayMessageId === discordMessageId
		);
	}

	/**
	 * Maps a reaction on one side of a ticket to relay message ids on every
	 * other linked channel (staff channel/post and participant DMs).
	 */
	static resolveRelayReactionTargets(
		reactedDiscordId: string,
		sourceChannelId: string,
		thread: { id: number; channelId?: string | null; dmChannelId?: string | null },
		db: DbClient = container.sqlite
	): { targetChannelId: string; targetMessageId: string }[] {
		const row = this.findLogicalMessage(reactedDiscordId, db);
		if (!row || row.threadId !== thread.id) return [];

		const targets: { targetChannelId: string; targetMessageId: string }[] = [];

		for (const targetChannelId of this.listRelayTargetChannels(thread, db)) {
			if (targetChannelId === sourceChannelId) continue;

			let targetMessageId: string | undefined;

			if (reactedDiscordId === row.messageId && row.channelId === sourceChannelId) {
				targetMessageId = this.getRelayDiscordIdForTarget(row, targetChannelId, db);
			} else if (this.isRelayOnChannel(row, sourceChannelId, reactedDiscordId, db)) {
				targetMessageId =
					row.channelId === targetChannelId
						? row.messageId
						: this.getRelayDiscordIdForTarget(row, targetChannelId, db);
			}

			if (targetMessageId) {
				targets.push({ targetChannelId, targetMessageId });
			}
		}

		return targets;
	}

	private static listRelayTargetChannels(
		thread: { id: number; channelId?: string | null; dmChannelId?: string | null },
		db: DbClient
	) {
		const channels = new Set<string>();
		if (thread.channelId) channels.add(thread.channelId);
		if (thread.dmChannelId) channels.add(thread.dmChannelId);

		for (const participant of TicketService.listUserParticipants(thread.id, db)) {
			if (participant.dmChannelId) channels.add(participant.dmChannelId);
		}

		return [...channels];
	}

	/** Every Discord copy of a logical message (source + relays). */
	static listPhysicalDiscordMessages(logical: typeof messages.$inferSelect, db: DbClient = container.sqlite) {
		const seen = new Set<string>();
		const copies: { channelId: string; messageId: string }[] = [];

		const add = (channelId: string, messageId: string) => {
			const key = `${channelId}:${messageId}`;
			if (seen.has(key)) return;
			seen.add(key);
			copies.push({ channelId, messageId });
		};

		add(logical.channelId, logical.messageId);

		for (const relay of MessageRelayService.listByMessage(logical.id, db)) {
			add(relay.targetChannelId, relay.relayMessageId);
		}

		if (logical.relayMessageId) {
			const relayRows = MessageRelayService.listByMessage(logical.id, db);
			const relayKnown = relayRows.some((relay) => relay.relayMessageId === logical.relayMessageId);
			if (!relayKnown) {
				const thread = TicketService.findById(logical.threadId, db);
				if (thread?.channelId && logical.channelId !== thread.channelId) {
					add(thread.channelId, logical.relayMessageId);
				} else if (thread?.dmChannelId && logical.channelId !== thread.dmChannelId) {
					add(thread.dmChannelId, logical.relayMessageId);
				}
			}
		}

		return copies;
	}

	static findByRelayMessageId(relayMessageId: string, db: DbClient = container.sqlite) {
		return db.select().from(messages).where(eq(messages.relayMessageId, relayMessageId)).get();
	}

	static enrichMessages(page: (typeof messages.$inferSelect)[], db: DbClient = container.sqlite): EnrichedMessage[] {
		if (page.length === 0) return [];

		const messageIds = page.map((m) => m.id);
		const snapshotIds = [...new Set(page.map((m) => m.memberSnapshotId).filter((id): id is number => id != null))];

		const snapshotsRaw =
			snapshotIds.length > 0 ? db.select().from(memberSnapshots).where(inArray(memberSnapshots.id, snapshotIds)).all() : [];
		const snapshotMap = new Map(snapshotsRaw.map((s) => [s.id, s]));

		const attachmentsRaw = db.select().from(attachments).where(inArray(attachments.messageId, messageIds)).all();
		const attachmentsMap = new Map<number, (typeof attachmentsRaw)[number][]>();
		for (const a of attachmentsRaw) {
			if (a.messageId === null) continue;
			const list = attachmentsMap.get(a.messageId) ?? [];
			list.push(a);
			attachmentsMap.set(a.messageId, list);
		}

		const editedMessageIds = page.filter((message) => message.revision > 1).map((message) => message.id);
		const revisionsRaw =
			editedMessageIds.length > 0
				? db
						.select()
						.from(messageRevisions)
						.where(inArray(messageRevisions.messageId, editedMessageIds))
						.orderBy(asc(messageRevisions.revision))
						.all()
				: [];
		const revisionsMap = new Map<number, MessageRevisionSnapshot[]>();
		for (const revision of revisionsRaw) {
			const list = revisionsMap.get(revision.messageId) ?? [];
			list.push({
				revision: revision.revision,
				content: revision.content,
				editedAt: revision.editedAt
			});
			revisionsMap.set(revision.messageId, list);
		}

		const reactionsMap = MessageReactionService.aggregateByMessage(messageIds, db);

		const replyTargetIds = [
			...new Set(page.map((message) => message.replyToMessageId).filter((id): id is number => id != null))
		];
		const replyTargetsRaw =
			replyTargetIds.length > 0
				? db.select().from(messages).where(inArray(messages.id, replyTargetIds)).all()
				: [];
		const replySnapshotIds = [
			...new Set(
				replyTargetsRaw.map((message) => message.memberSnapshotId).filter((id): id is number => id != null)
			)
		];
		const replySnapshotsRaw =
			replySnapshotIds.length > 0
				? db.select().from(memberSnapshots).where(inArray(memberSnapshots.id, replySnapshotIds)).all()
				: [];
		const replySnapshotMap = new Map(replySnapshotsRaw.map((snapshot) => [snapshot.id, snapshot]));
		const replyPreviewMap = new Map<number, MessageReplyPreview>();

		for (const target of replyTargetsRaw) {
			const snapshot =
				target.memberSnapshotId !== null ? (replySnapshotMap.get(target.memberSnapshotId) ?? null) : null;
			const authorName = snapshot?.globalName ?? snapshot?.username ?? null;

			replyPreviewMap.set(target.id, {
				id: target.id,
				authorId: target.authorId,
				authorName,
				authorAvatar: snapshot?.avatar ?? null,
				content: target.content,
				deletedAt: target.deletedAt
			});
		}

		return page.map((m) => ({
			...m,
			author: m.memberSnapshotId !== null ? (snapshotMap.get(m.memberSnapshotId) ?? null) : null,
			attachments: attachmentsMap.get(m.id) ?? [],
			editHistory: revisionsMap.get(m.id) ?? [],
			reactions: reactionsMap.get(m.id) ?? [],
			replyTo: m.replyToMessageId ? (replyPreviewMap.get(m.replyToMessageId) ?? null) : null
		}));
	}

	/**
	 * Paginated message history for a thread, enriched with each message's
	 * author snapshot and attachments. Newest-first (same offset-cursor
	 * pattern as TicketService.listTickets) — the client reverses for
	 * chronological chat display.
	 */
	static listMessages(input: ListMessagesInput, db: DbClient = container.sqlite): ListMessagesResult {
		const limit = input.limit ?? 30;
		const cursor = input.cursor ?? 0;

		const conditions = [eq(messages.threadId, input.threadId)];
		if (!input.includeDeleted) conditions.push(isNull(messages.deletedAt));

		const rows = db
			.select()
			.from(messages)
			.where(and(...conditions))
			.orderBy(desc(messages.createdAt))
			.limit(limit + 1)
			.offset(cursor)
			.all();

		const hasMore = rows.length > limit;
		const page = hasMore ? rows.slice(0, limit) : rows;
		const nextCursor = hasMore ? cursor + limit : null;

		if (page.length === 0) {
			return { messages: [], nextCursor };
		}

		return {
			messages: this.enrichMessages(page, db),
			nextCursor
		};
	}
}