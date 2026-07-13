import { memberSnapshots } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { desc, eq } from 'drizzle-orm';
import type { GuildMember, User } from 'discord.js';
import type { DbClient } from './types';

export abstract class MemberSnapshotService {
	/**
	 * Captures a point-in-time snapshot of a user's (or member's) identity —
	 * call this before creating a message/note so historical logs still show
	 * the right name/avatar/roles even if the user later changes them or
	 * leaves the guild.
	 */
	static capture(source: User | GuildMember, db: DbClient = container.sqlite) {
		const isMember = 'user' in source;
		const user = isMember ? source.user : source;
		const member = isMember ? source : undefined;

		return db
			.insert(memberSnapshots)
			.values({
				userId: user.id,
				username: user.username,
				globalName: user.globalName ?? null,
				avatar: user.avatar ?? null,
				nickname: member?.nickname ?? null,
				roleIds: member ? [...member.roles.cache.keys()] : null,
				highestRoleId: member?.roles.highest.id ?? null,
				capturedAt: new Date()
			})
			.returning()
			.get();
	}

	static findLatestForUser(userId: string, db: DbClient = container.sqlite) {
		return db.select().from(memberSnapshots).where(eq(memberSnapshots.userId, userId)).orderBy(desc(memberSnapshots.capturedAt)).limit(1).get();
	}

	static findById(id: number, db: DbClient = container.sqlite) {
		return db.select().from(memberSnapshots).where(eq(memberSnapshots.id, id)).get();
	}
}