import {
	attachments,
	auditLog,
	blockedEntities,
	memberSnapshots,
	messageRelays,
	messages,
	notes,
	pendingTicketOpens,
	threadParticipants,
	threadStatusHistory,
	threadTags,
	threads
} from '@/database/sqlite/schema';
import { GDPR_ERASE_MODE, type GdprEraseMode } from '@/lib/dataPrivacy/categories';
import {
	buildUserReferenceProfile,
	generateAnonymousUserId,
	scrubTextForUserReferences,
	scrubUnknownValue
} from '@/lib/dataPrivacy/userReferences';
import { BlockEntityType } from '@/services/block';
import { container } from '@sapphire/framework';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import type { DbClient } from './types';

export type GdprExport = {
	exportedAt: string;
	subjectUserId: string;
	dataController: {
		product: 'imi/tickets';
	};
	profile: {
		snapshots: (typeof memberSnapshots.$inferSelect)[];
	};
	tickets: (typeof threads.$inferSelect)[];
	participants: (typeof threadParticipants.$inferSelect)[];
	messages: Array<typeof messages.$inferSelect & { attachments: (typeof attachments.$inferSelect)[] }>;
	threadNotes: Array<typeof notes.$inferSelect & { attachments: (typeof attachments.$inferSelect)[] }>;
	threadTags: (typeof threadTags.$inferSelect)[];
	threadStatusHistory: (typeof threadStatusHistory.$inferSelect)[];
	auditLog: (typeof auditLog.$inferSelect)[];
	blockedEntities: (typeof blockedEntities.$inferSelect)[];
	pendingTicketOpen: typeof pendingTicketOpens.$inferSelect | null;
};

export abstract class GdprService {
	static exportUser(userId: string, db: DbClient = container.sqlite): GdprExport {
		const context = this.collectUserContext(userId, db);
		const messageIds = context.messages.map((message) => message.id);
		const noteIds = context.notes.map((note) => note.id);

		const messageAttachments =
			messageIds.length > 0
				? db.select().from(attachments).where(inArray(attachments.messageId, messageIds)).all()
				: [];
		const noteAttachments =
			noteIds.length > 0 ? db.select().from(attachments).where(inArray(attachments.noteId, noteIds)).all() : [];

		const attachmentsByMessage = groupBy(messageAttachments, (row) => row.messageId ?? -1);
		const attachmentsByNote = groupBy(noteAttachments, (row) => row.noteId ?? -1);

		return {
			exportedAt: new Date().toISOString(),
			subjectUserId: userId,
			dataController: { product: 'imi/tickets' },
			profile: { snapshots: context.snapshots },
			tickets: context.ticketRows,
			participants: context.participants,
			messages: context.messages.map((message) => ({
				...message,
				attachments: attachmentsByMessage.get(message.id) ?? []
			})),
			threadNotes: context.notes.map((note) => ({
				...note,
				attachments: attachmentsByNote.get(note.id) ?? []
			})),
			threadTags: context.tags,
			threadStatusHistory: context.statusHistory,
			auditLog: context.auditRows,
			blockedEntities: context.blockRows,
			pendingTicketOpen: context.pendingOpen
		};
	}

	static processUser(
		userId: string,
		mode: GdprEraseMode,
		executedBy: string,
		db: DbClient = container.sqlite
	) {
		if (mode === GDPR_ERASE_MODE.Erase) {
			return this.eraseUser(userId, executedBy, db);
		}

		return this.anonymizeUser(userId, executedBy, db);
	}

	static anonymizeUser(userId: string, executedBy: string, db: DbClient = container.sqlite) {
		const anonymousUserId = generateAnonymousUserId();

		return db.transaction((tx) => {
			const context = this.collectUserContext(userId, tx);
			const profile = buildUserReferenceProfile(userId, context.snapshots);

			scrubThreadMessages(context.threadIds, profile, tx);
			scrubAuditRows(userId, profile, anonymousUserId, tx);
			rewriteUserIdentifiers(userId, anonymousUserId, tx);
			scrubSnapshotsForUser(userId, anonymousUserId, tx);

			AuditService.log(
				{
					action: AuditAction.GdprAnonymized,
					executedBy,
					userId: anonymousUserId,
					payload: {
						originalUserId: userId,
						anonymousUserId,
						threadCount: context.threadIds.length,
						messageCount: context.messages.length
					}
				},
				tx
			);

			return {
				mode: GDPR_ERASE_MODE.Anonymize,
				originalUserId: userId,
				anonymousUserId,
				threadCount: context.threadIds.length,
				messageCount: context.messages.length
			};
		});
	}

	static eraseUser(userId: string, executedBy: string, db: DbClient = container.sqlite) {
		return db.transaction((tx) => {
			const context = this.collectUserContext(userId, tx);
			const profile = buildUserReferenceProfile(userId, context.snapshots);

			scrubThreadMessages(context.threadIds, profile, tx);

			const ownedThreadIds = context.ticketRows.filter((thread) => thread.userId === userId).map((thread) => thread.id);
			const sharedThreadIds = context.threadIds.filter((threadId) => !ownedThreadIds.includes(threadId));

			const userMessageIds = context.messages
				.filter((message) => message.authorId === userId)
				.map((message) => message.id);

			if (userMessageIds.length > 0) {
				tx.delete(messageRelays).where(inArray(messageRelays.messageId, userMessageIds)).run();
				tx.delete(attachments).where(inArray(attachments.messageId, userMessageIds)).run();
				tx.delete(messages).where(inArray(messages.id, userMessageIds)).run();
			}

			if (ownedThreadIds.length > 0) {
				deleteThreadsByIds(ownedThreadIds, tx);
			}

			if (sharedThreadIds.length > 0) {
				tx.delete(threadParticipants)
					.where(and(inArray(threadParticipants.threadId, sharedThreadIds), eq(threadParticipants.userId, userId)))
					.run();
			}

			tx.delete(memberSnapshots).where(eq(memberSnapshots.userId, userId)).run();
			tx.delete(pendingTicketOpens).where(eq(pendingTicketOpens.userId, userId)).run();
			tx.delete(blockedEntities)
				.where(and(eq(blockedEntities.entityType, BlockEntityType.User), eq(blockedEntities.entityId, userId)))
				.run();
			tx.delete(auditLog).where(or(eq(auditLog.userId, userId), eq(auditLog.executedBy, userId))).run();

			AuditService.log(
				{
					action: AuditAction.GdprErased,
					executedBy,
					payload: {
						originalUserId: userId,
						ownedThreadIds,
						sharedThreadIds,
						deletedMessageCount: userMessageIds.length
					}
				},
				tx
			);

			return {
				mode: GDPR_ERASE_MODE.Erase,
				originalUserId: userId,
				ownedThreadIds,
				sharedThreadIds,
				deletedMessageCount: userMessageIds.length
			};
		});
	}

	private static collectUserContext(userId: string, db: DbClient) {
		const participants = db.select().from(threadParticipants).where(eq(threadParticipants.userId, userId)).all();
		const ownedTickets = db.select().from(threads).where(eq(threads.userId, userId)).all();
		const threadIds = [
			...new Set([
				...participants.map((participant) => participant.threadId),
				...ownedTickets.map((ticket) => ticket.id)
			])
		];

		const ticketRows =
			threadIds.length > 0 ? db.select().from(threads).where(inArray(threads.id, threadIds)).all() : [];
		const threadMessages =
			threadIds.length > 0 ? db.select().from(messages).where(inArray(messages.threadId, threadIds)).all() : [];
		const threadNotes =
			threadIds.length > 0 ? db.select().from(notes).where(inArray(notes.threadId, threadIds)).all() : [];
		const tags =
			threadIds.length > 0 ? db.select().from(threadTags).where(inArray(threadTags.threadId, threadIds)).all() : [];
		const statusHistory =
			threadIds.length > 0
				? db.select().from(threadStatusHistory).where(inArray(threadStatusHistory.threadId, threadIds)).all()
				: [];

		const snapshots = db.select().from(memberSnapshots).where(eq(memberSnapshots.userId, userId)).all();
		const authoredMessages = db.select().from(messages).where(eq(messages.authorId, userId)).all();
		const messagesById = new Map<number, typeof messages.$inferSelect>();
		for (const message of [...threadMessages, ...authoredMessages]) {
			messagesById.set(message.id, message);
		}

		const auditRows = db
			.select()
			.from(auditLog)
			.where(or(eq(auditLog.userId, userId), eq(auditLog.executedBy, userId)))
			.all();
		const blockRows = db
			.select()
			.from(blockedEntities)
			.where(eq(blockedEntities.entityId, userId))
			.all();
		const pendingOpen = db.select().from(pendingTicketOpens).where(eq(pendingTicketOpens.userId, userId)).get() ?? null;

		return {
			threadIds,
			ticketRows,
			participants,
			messages: [...messagesById.values()],
			notes: threadNotes,
			tags,
			statusHistory,
			snapshots,
			auditRows,
			blockRows,
			pendingOpen
		};
	}
}

function scrubThreadMessages(threadIds: number[], profile: ReturnType<typeof buildUserReferenceProfile>, db: DbClient) {
	if (threadIds.length === 0) return;

	const rows = db.select().from(messages).where(inArray(messages.threadId, threadIds)).all();
	for (const row of rows) {
		const content = scrubTextForUserReferences(row.content, profile);
		if (content === row.content) continue;
		db.update(messages).set({ content, updatedAt: new Date() }).where(eq(messages.id, row.id)).run();
	}

	const noteRows = db.select().from(notes).where(inArray(notes.threadId, threadIds)).all();
	for (const row of noteRows) {
		const content = scrubTextForUserReferences(row.content, profile);
		if (content === row.content) continue;
		db.update(notes).set({ content }).where(eq(notes.id, row.id)).run();
	}
}

function rewriteUserIdentifiers(userId: string, anonymousUserId: string, db: DbClient) {
	db.update(threads).set({ userId: anonymousUserId, dmChannelId: null }).where(eq(threads.userId, userId)).run();
	db.update(threadParticipants)
		.set({ userId: anonymousUserId, dmChannelId: null })
		.where(eq(threadParticipants.userId, userId))
		.run();
	db.update(messages).set({ authorId: anonymousUserId }).where(eq(messages.authorId, userId)).run();
	db.update(notes).set({ authorId: anonymousUserId }).where(eq(notes.authorId, userId)).run();
	db.update(messageRelays)
		.set({ recipientUserId: anonymousUserId })
		.where(eq(messageRelays.recipientUserId, userId))
		.run();
	db.update(blockedEntities)
		.set({
			entityId: anonymousUserId,
			blockedBy: sql`CASE WHEN ${blockedEntities.blockedBy} = ${userId} THEN ${anonymousUserId} ELSE ${blockedEntities.blockedBy} END`
		})
		.where(eq(blockedEntities.entityId, userId))
		.run();
	db.update(pendingTicketOpens)
		.set({ userId: anonymousUserId, dmChannelId: '[redacted]' })
		.where(eq(pendingTicketOpens.userId, userId))
		.run();
}

function scrubSnapshotsForUser(userId: string, anonymousUserId: string, db: DbClient) {
	db.update(memberSnapshots)
		.set({
			userId: anonymousUserId,
			username: null,
			globalName: null,
			avatar: null,
			roleIds: null,
			highestRoleId: null,
			nickname: null
		})
		.where(eq(memberSnapshots.userId, userId))
		.run();
}

function scrubAuditRows(
	userId: string,
	profile: ReturnType<typeof buildUserReferenceProfile>,
	anonymousUserId: string,
	db: DbClient
) {
	const rows = db
		.select()
		.from(auditLog)
		.where(or(eq(auditLog.userId, userId), eq(auditLog.executedBy, userId)))
		.all();

	for (const row of rows) {
		db.update(auditLog)
			.set({
				userId: row.userId === userId ? anonymousUserId : row.userId,
				executedBy: row.executedBy === userId ? anonymousUserId : row.executedBy,
				payload: row.payload ? (scrubUnknownValue(row.payload, profile) as object) : null
			})
			.where(eq(auditLog.id, row.id))
			.run();
	}
}

function deleteThreadsByIds(threadIds: number[], db: DbClient) {
	if (threadIds.length === 0) return;

	const messageIds = db
		.select({ id: messages.id })
		.from(messages)
		.where(inArray(messages.threadId, threadIds))
		.all()
		.map((row) => row.id);
	const noteIds = db
		.select({ id: notes.id })
		.from(notes)
		.where(inArray(notes.threadId, threadIds))
		.all()
		.map((row) => row.id);

	if (messageIds.length > 0) {
		db.delete(messageRelays).where(inArray(messageRelays.messageId, messageIds)).run();
		db.delete(attachments).where(inArray(attachments.messageId, messageIds)).run();
		db.delete(messages).where(inArray(messages.id, messageIds)).run();
	}

	if (noteIds.length > 0) {
		db.delete(attachments).where(inArray(attachments.noteId, noteIds)).run();
		db.delete(notes).where(inArray(notes.id, noteIds)).run();
	}

	db.delete(threadParticipants).where(inArray(threadParticipants.threadId, threadIds)).run();
	db.delete(threadTags).where(inArray(threadTags.threadId, threadIds)).run();
	db.delete(threadStatusHistory).where(inArray(threadStatusHistory.threadId, threadIds)).run();
	db.delete(threads).where(inArray(threads.id, threadIds)).run();
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K) {
	const map = new Map<K, T[]>();
	for (const item of items) {
		const key = keyFn(item);
		const bucket = map.get(key);
		if (bucket) bucket.push(item);
		else map.set(key, [item]);
	}
	return map;
}
