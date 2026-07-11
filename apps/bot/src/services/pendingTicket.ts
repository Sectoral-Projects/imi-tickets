import { pendingTicketOpens } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { eq, lt } from 'drizzle-orm';
import type { DbClient } from './types';

const PENDING_TICKET_TTL_MS = 24 * 60 * 60 * 1000;

export interface SavePendingTicketInput {
	userId: string;
	dmChannelId: string;
	firstMessageId: string;
	firstMessageContent: string;
}

export abstract class PendingTicketService {
	static save(input: SavePendingTicketInput, db: DbClient = container.sqlite) {
		const now = new Date();
		return db
			.insert(pendingTicketOpens)
			.values({
				userId: input.userId,
				dmChannelId: input.dmChannelId,
				firstMessageId: input.firstMessageId,
				firstMessageContent: input.firstMessageContent,
				createdAt: now
			})
			.onConflictDoUpdate({
				target: pendingTicketOpens.userId,
				set: {
					dmChannelId: input.dmChannelId,
					firstMessageId: input.firstMessageId,
					firstMessageContent: input.firstMessageContent,
					createdAt: now
				}
			})
			.returning()
			.get();
	}

	static find(userId: string, db: DbClient = container.sqlite) {
		this.deleteExpired(db);
		return db.select().from(pendingTicketOpens).where(eq(pendingTicketOpens.userId, userId)).limit(1).get();
	}

	static delete(userId: string, db: DbClient = container.sqlite) {
		return db.delete(pendingTicketOpens).where(eq(pendingTicketOpens.userId, userId)).run();
	}

	static deleteExpired(db: DbClient = container.sqlite) {
		const cutoff = new Date(Date.now() - PENDING_TICKET_TTL_MS);
		return db.delete(pendingTicketOpens).where(lt(pendingTicketOpens.createdAt, cutoff)).run();
	}
}
