import { auditLog } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, desc, eq } from 'drizzle-orm';
import { AuditDiscordService } from './auditDiscord';
import type { DbClient } from './types';

/**
 * Known audit actions. `AuditActionType` still accepts any string
 * (via the `string & {}` trick) so you're never blocked from logging
 * something new, but you get autocomplete for the common cases.
 */
export const AuditAction = {
	ThreadCreated: 'thread.created',
	ThreadClosed: 'thread.closed',
	ThreadReopened: 'thread.reopened',
	ThreadRenamed: 'thread.renamed',
	ThreadTagAdded: 'thread.tag.added',
	ThreadTagRemoved: 'thread.tag.removed',
	ThreadCloseScheduled: 'thread.close.scheduled',
	ThreadCloseScheduleCancelled: 'thread.close.schedule_cancelled',

	MessageCreated: 'message.created',
	MessageUpdated: 'message.updated',
	MessageDeleted: 'message.deleted',

	NoteCreated: 'note.created',
	NoteDeleted: 'note.deleted',

	AttachmentCreated: 'attachment.created',
	AttachmentDeleted: 'attachment.deleted',

	MemberSnapshotCreated: 'member.snapshot.created',

	ConfigUpdated: 'config.updated',

	TemplateCreated: 'template.created',
	TemplateUpdated: 'template.updated',
	TemplateDeleted: 'template.deleted',
	EntityBlocked: 'entity.blocked',
	EntityUnblocked: 'entity.unblocked',

	GdprExported: 'gdpr.exported',
	GdprAnonymized: 'gdpr.anonymized',
	GdprErased: 'gdpr.erased',
	DataBulkDeleted: 'data.bulk_deleted',

	ParticipantAdded: 'participant.added',
	ParticipantRemoved: 'participant.removed',
	ParticipantDmsUnavailable: 'participant.dms_unavailable',
	ParticipantDmsAvailable: 'participant.dms_available'
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction] | (string & {});

export interface AuditLogInput {
	action: AuditActionType;
	executedBy: string;
	threadId?: number;
	messageId?: string;
	noteId?: number;
	userId?: string;
	channelId?: string;
	payload?: unknown;
}

export abstract class AuditService {
	/**
	 * Writes an audit log entry.
	 *
	 * Pass `db` as a transaction (`tx`) to include this write atomically
	 * alongside whatever else you're persisting — this is how every other
	 * service in this project logs its actions.
	 */
	static log(data: AuditLogInput, db: DbClient = container.sqlite) {
		const entry = db
			.insert(auditLog)
			.values({
				action: data.action,
				executedBy: data.executedBy,
				threadId: data.threadId,
				messageId: data.messageId,
				noteId: data.noteId,
				userId: data.userId,
				channelId: data.channelId,
				payload: data.payload === undefined ? null : (data.payload as object),
				createdAt: new Date()
			})
			.returning()
			.get();

		AuditDiscordService.notify(entry);

		return entry;
	}

	/**
	 * Replaces an existing audit row in place (same id/timestamp) so timeline markers
	 * can morph without adding a second entry — e.g. scheduled close → cancelled.
	 */
	static replace(
		id: number,
		data: Pick<AuditLogInput, 'action' | 'executedBy' | 'payload'>,
		db: DbClient = container.sqlite
	) {
		const entry = db
			.update(auditLog)
			.set({
				action: data.action,
				executedBy: data.executedBy,
				payload: data.payload === undefined ? null : (data.payload as object)
			})
			.where(eq(auditLog.id, id))
			.returning()
			.get();

		if (entry) {
			AuditDiscordService.notify(entry);
		}

		return entry ?? null;
	}

	/** Latest lifecycle audit of the given action for a thread, if any. */
	static findLatestForThread(
		threadId: number,
		action: AuditActionType,
		db: DbClient = container.sqlite
	) {
		return db
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.threadId, threadId), eq(auditLog.action, action)))
			.orderBy(desc(auditLog.createdAt))
			.limit(1)
			.get();
	}

	/** Convenience read helper for building a thread's activity timeline. */
	static listForThread(threadId: number, db: DbClient = container.sqlite) {
		return db.select().from(auditLog).where(eq(auditLog.threadId, threadId)).orderBy(desc(auditLog.createdAt)).all();
	}
}
