import { blockedEntities } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import { SetupService } from './setup';
import type { DbClient } from './types';

export const BlockEntityType = {
	User: 'user',
	Role: 'role'
} as const;
export type BlockEntityType = (typeof BlockEntityType)[keyof typeof BlockEntityType];

export interface BlockEntityInput {
	entityType: BlockEntityType;
	entityId: string;
	blockedBy: string;
	reason?: string | null;
}

export interface ListBlockedInput {
	cursor?: number;
	limit?: number;
}

export type BlockedEntity = typeof blockedEntities.$inferSelect;

export abstract class BlockService {
	static block(input: BlockEntityInput, db: DbClient = container.sqlite) {
		const now = new Date();
		const values = {
			entityType: input.entityType,
			entityId: input.entityId,
			blockedBy: input.blockedBy,
			reason: normalizeReason(input.reason),
			createdAt: now
		};

		const row = db
			.insert(blockedEntities)
			.values(values)
			.onConflictDoUpdate({
				target: [blockedEntities.entityType, blockedEntities.entityId],
				set: values
			})
			.returning()
			.get();

		AuditService.log({
			action: AuditAction.EntityBlocked,
			executedBy: input.blockedBy,
			userId: input.entityType === BlockEntityType.User ? input.entityId : undefined,
			payload: {
				entityType: input.entityType,
				entityId: input.entityId,
				reason: values.reason
			}
		});

		return row;
	}

	static unblock(entityType: BlockEntityType, entityId: string, executedBy: string, db: DbClient = container.sqlite) {
		const deleted = db
			.delete(blockedEntities)
			.where(and(eq(blockedEntities.entityType, entityType), eq(blockedEntities.entityId, entityId)))
			.returning()
			.get();

		if (!deleted) return null;

		AuditService.log({
			action: AuditAction.EntityUnblocked,
			executedBy,
			userId: entityType === BlockEntityType.User ? entityId : undefined,
			payload: { entityType, entityId }
		});

		return deleted;
	}

	static list(input: ListBlockedInput = {}, db: DbClient = container.sqlite) {
		const limit = input.limit ?? 10;
		const cursor = input.cursor ?? 0;
		const rows = db
			.select()
			.from(blockedEntities)
			.orderBy(asc(blockedEntities.id))
			.limit(limit + 1)
			.offset(cursor)
			.all();

		const hasMore = rows.length > limit;
		return {
			entries: hasMore ? rows.slice(0, limit) : rows,
			nextCursor: hasMore ? cursor + limit : null
		};
	}

	static findUserBlock(userId: string, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(blockedEntities)
			.where(and(eq(blockedEntities.entityType, BlockEntityType.User), eq(blockedEntities.entityId, userId)))
			.limit(1)
			.get();
	}

	static async findBlockForUser(userId: string, db: DbClient = container.sqlite): Promise<BlockedEntity | null> {
		const userBlock = this.findUserBlock(userId, db);
		if (userBlock) return userBlock;

		const roleBlocks = db
			.select()
			.from(blockedEntities)
			.where(eq(blockedEntities.entityType, BlockEntityType.Role))
			.all();
		if (roleBlocks.length === 0) return null;

		const roleIds = new Set(roleBlocks.map((entry) => entry.entityId));
		for (const guildId of roleBlockGuildIds(db)) {
			const member = await fetchGuildMember(guildId, userId);
			if (!member) continue;

			const blockedRole = member.roles.cache.find((role) => roleIds.has(role.id));
			if (!blockedRole) continue;

			return roleBlocks.find((entry) => entry.entityId === blockedRole.id) ?? null;
		}

		return null;
	}

	static listByRoleIds(roleIds: string[], db: DbClient = container.sqlite) {
		if (roleIds.length === 0) return [];
		return db
			.select()
			.from(blockedEntities)
			.where(and(eq(blockedEntities.entityType, BlockEntityType.Role), inArray(blockedEntities.entityId, roleIds)))
			.all();
	}
}

function normalizeReason(reason: string | null | undefined) {
	if (reason == null) return null;
	const trimmed = reason.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function roleBlockGuildIds(_db: DbClient) {
	const botGuildIds = [...container.client.guilds.cache.keys()];
	if (botGuildIds.length > 0) return botGuildIds;

	const setup = SetupService.getStatus(undefined, _db);
	return setup.linkedGuilds.map((guild) => guild.guildId);
}

async function fetchGuildMember(guildId: string, userId: string) {
	const guild = await container.client.guilds.fetch(guildId).catch(() => null);
	if (!guild) return null;

	return guild.members.fetch({ user: userId, force: true }).catch(() => null) ?? null;
}
