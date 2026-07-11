import { attachments } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import type { DbClient } from './types';

/** Mirrors the `attachments_parent_check` constraint: exactly one parent, never both/neither. */
export type AttachmentParent = { messageId: number; noteId?: never } | { noteId: number; messageId?: never };

export interface CreateAttachmentInput {
	url: string;
	name?: string;
	isSpoiler?: boolean;
}

export abstract class AttachmentService {
	static create(data: AttachmentParent & CreateAttachmentInput, db: DbClient = container.sqlite) {
		return db
			.insert(attachments)
			.values({
				messageId: data.messageId ?? null,
				noteId: data.noteId ?? null,
				url: data.url,
				name: data.name,
				isSpoiler: data.isSpoiler ?? false,
				createdAt: new Date()
			})
			.returning()
			.get();
	}

	static listForMessage(messageId: number, db: DbClient = container.sqlite) {
		return db.select().from(attachments).where(eq(attachments.messageId, messageId)).all();
	}

	static listForNote(noteId: number, db: DbClient = container.sqlite) {
		return db.select().from(attachments).where(eq(attachments.noteId, noteId)).all();
	}
}