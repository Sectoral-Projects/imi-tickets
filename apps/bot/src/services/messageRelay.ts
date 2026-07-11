import { messageRelays } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import type { DbClient } from './types';

export interface MessageRelayInput {
	messageId: number;
	targetChannelId: string;
	relayMessageId: string;
	recipientUserId?: string;
}

export abstract class MessageRelayService {
	static add(input: MessageRelayInput, db: DbClient = container.sqlite) {
		return db
			.insert(messageRelays)
			.values({
				messageId: input.messageId,
				targetChannelId: input.targetChannelId,
				relayMessageId: input.relayMessageId,
				recipientUserId: input.recipientUserId
			})
			.onConflictDoUpdate({
				target: [messageRelays.messageId, messageRelays.targetChannelId],
				set: {
					relayMessageId: input.relayMessageId,
					recipientUserId: input.recipientUserId
				}
			})
			.run();
	}

	static findByRelayMessageId(relayMessageId: string, db: DbClient = container.sqlite) {
		return db.select().from(messageRelays).where(eq(messageRelays.relayMessageId, relayMessageId)).get();
	}

	static listByMessage(messageId: number, db: DbClient = container.sqlite) {
		return db.select().from(messageRelays).where(eq(messageRelays.messageId, messageId)).all();
	}
}
