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
import { DataCategory, type DataCategoryType, expandDataCategories } from '@/lib/dataPrivacy/categories';
import { container } from '@sapphire/framework';
import { count, inArray, sql } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import type { DbClient } from './types';

export type DataDeletionPreview = {
	categories: DataCategoryType[];
	counts: Record<DataCategoryType, number>;
};

export abstract class DataDeletionService {
	static preview(categories: DataCategoryType[], db: DbClient = container.sqlite): DataDeletionPreview {
		const expanded = expandDataCategories(categories);

		return {
			categories: expanded,
			counts: {
				[DataCategory.Tickets]: expanded.includes(DataCategory.Tickets) ? db.select({ value: count() }).from(threads).get()?.value ?? 0 : 0,
				[DataCategory.MemberSnapshots]: expanded.includes(DataCategory.MemberSnapshots)
					? db.select({ value: count() }).from(memberSnapshots).get()?.value ?? 0
					: 0,
				[DataCategory.AuditLog]: expanded.includes(DataCategory.AuditLog)
					? db.select({ value: count() }).from(auditLog).get()?.value ?? 0
					: 0,
				[DataCategory.BlockedEntities]: expanded.includes(DataCategory.BlockedEntities)
					? db.select({ value: count() }).from(blockedEntities).get()?.value ?? 0
					: 0,
				[DataCategory.PendingTicketOpens]: expanded.includes(DataCategory.PendingTicketOpens)
					? db.select({ value: count() }).from(pendingTicketOpens).get()?.value ?? 0
					: 0
			}
		};
	}

	static execute(categories: DataCategoryType[], executedBy: string, db: DbClient = container.sqlite) {
		const expanded = expandDataCategories(categories);

		return db.transaction((tx) => {
			const deleted: DataDeletionPreview['counts'] = {
				[DataCategory.Tickets]: 0,
				[DataCategory.MemberSnapshots]: 0,
				[DataCategory.AuditLog]: 0,
				[DataCategory.BlockedEntities]: 0,
				[DataCategory.PendingTicketOpens]: 0
			};

			if (expanded.includes(DataCategory.Tickets)) {
				deleted[DataCategory.Tickets] = this.deleteAllTickets(tx);
			}

			if (expanded.includes(DataCategory.MemberSnapshots)) {
				deleted[DataCategory.MemberSnapshots] = this.deleteAllMemberSnapshots(tx);
			}

			if (expanded.includes(DataCategory.AuditLog)) {
				deleted[DataCategory.AuditLog] = tx.delete(auditLog).run().changes;
			}

			if (expanded.includes(DataCategory.BlockedEntities)) {
				deleted[DataCategory.BlockedEntities] = tx.delete(blockedEntities).run().changes;
			}

			if (expanded.includes(DataCategory.PendingTicketOpens)) {
				deleted[DataCategory.PendingTicketOpens] = tx.delete(pendingTicketOpens).run().changes;
			}

			AuditService.log(
				{
					action: AuditAction.DataBulkDeleted,
					executedBy,
					payload: {
						categories: expanded,
						deleted
					}
				},
				tx
			);

			return {
				categories: expanded,
				deleted
			};
		});
	}

	private static deleteAllTickets(db: DbClient) {
		const threadIds = db.select({ id: threads.id }).from(threads).all().map((row) => row.id);
		if (threadIds.length === 0) return 0;

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
		return db.delete(threads).where(inArray(threads.id, threadIds)).run().changes;
	}

	private static deleteAllMemberSnapshots(db: DbClient) {
		txNullifyMemberSnapshotReferences(db);
		return db.delete(memberSnapshots).run().changes;
	}
}

function txNullifyMemberSnapshotReferences(db: DbClient) {
	db.update(messages).set({ memberSnapshotId: null }).where(sql`${messages.memberSnapshotId} IS NOT NULL`).run();
}
