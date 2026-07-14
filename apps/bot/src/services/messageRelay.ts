import { messageRelays } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, eq } from 'drizzle-orm';
import type { DbClient } from './types';

export interface MessageRelayInput {
	messageId: number;
	targetChannelId: string;
	relayMessageId: string;
	recipientUserId?: string;
}

export abstract class MessageRelayService {
	static add(input: MessageRelayInput, db: DbClient = container.sqlite) {
		const values = {
			messageId: input.messageId,
			targetChannelId: input.targetChannelId,
			relayMessageId: input.relayMessageId,
			recipientUserId: input.recipientUserId
		};

		// Drizzle throws "No values to set" if onConflictDoUpdate.set is empty/undefined-only.
		if (input.recipientUserId !== undefined) {
			return db
				.insert(messageRelays)
				.values(values)
				.onConflictDoUpdate({
					target: [messageRelays.messageId, messageRelays.targetChannelId, messageRelays.relayMessageId],
					set: { recipientUserId: input.recipientUserId }
				})
				.run();
		}

		return db.insert(messageRelays).values(values).onConflictDoNothing().run();
	}

	static findByRelayMessageId(relayMessageId: string, db: DbClient = container.sqlite) {
		return db.select().from(messageRelays).where(eq(messageRelays.relayMessageId, relayMessageId)).get();
	}

	static listByMessage(messageId: number, db: DbClient = container.sqlite) {
		return db.select().from(messageRelays).where(eq(messageRelays.messageId, messageId)).all();
	}

	static deleteByRelayMessageId(relayMessageId: string, db: DbClient = container.sqlite) {
		return db.delete(messageRelays).where(eq(messageRelays.relayMessageId, relayMessageId)).run();
	}

	static replaceForMessageChannel(
		messageId: number,
		targetChannelId: string,
		relays: Omit<MessageRelayInput, 'messageId' | 'targetChannelId'>[],
		db: DbClient = container.sqlite
	) {
		db.delete(messageRelays)
			.where(and(eq(messageRelays.messageId, messageId), eq(messageRelays.targetChannelId, targetChannelId)))
			.run();

		for (const relay of relays) {
			this.add(
				{
					messageId,
					targetChannelId,
					relayMessageId: relay.relayMessageId,
					recipientUserId: relay.recipientUserId
				},
				db
			);
		}
	}
}
