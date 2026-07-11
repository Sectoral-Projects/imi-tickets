import { notes } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import type { DbClient } from './types';

export interface CreateNoteInput {
	threadId: number;
	authorId: string;
	content: string;
}

export abstract class NoteService {
	static create(data: CreateNoteInput) {
		return container.sqlite.transaction((tx) => {
			const note = tx
				.insert(notes)
				.values({
					threadId: data.threadId,
					authorId: data.authorId,
					content: data.content,
					createdAt: new Date()
				})
				.returning()
				.get();

			AuditService.log(
				{
					action: AuditAction.NoteCreated,
					executedBy: data.authorId,
					threadId: data.threadId,
					noteId: note.id
				},
				tx
			);

			return note;
		});
	}

	static softDelete(id: number, executedBy: string) {
		return container.sqlite.transaction((tx) => {
			const existing = tx.select().from(notes).where(eq(notes.id, id)).get();
			if (!existing) return null;

			const deleted = tx.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, id)).returning().get();

			AuditService.log(
				{
					action: AuditAction.NoteDeleted,
					executedBy,
					threadId: existing.threadId,
					noteId: id
				},
				tx
			);

			return deleted;
		});
	}

	static listByThread(threadId: number, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(notes)
			.where(and(eq(notes.threadId, threadId), isNull(notes.deletedAt)))
			.orderBy(desc(notes.createdAt))
			.all();
	}
}