import { config, guildStaffRolePermissions, linkedGuilds } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { count, eq } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import { RbacPermission, type RbacPermissionType } from './rbac';
import type { DbClient } from './types';

export const ChannelStrategy = {
	Category: 'category',
	Forum: 'forum'
} as const;

export type ChannelStrategyType = (typeof ChannelStrategy)[keyof typeof ChannelStrategy];

export interface LinkedGuildInput {
	guildId: string;
	name: string | null;
	isPrimary: boolean;
}

export interface RolePermissionInput {
	roleId: string;
	permissions: RbacPermissionType[];
}

export interface LinkedGuildStatus {
	guildId: string;
	name: string | null;
	isPrimary: boolean;
	channelStrategy: string | null;
	categoryChannelId: string | null;
	forumChannelId: string | null;
	rolePermissions: RolePermissionInput[];
}

export interface SetupStatus {
	complete: boolean;
	hasCustomRbacConfig: boolean;
	primaryGuildId: string | null;
	setupOwnerUserId: string | null;
	isSetupOwner: boolean;
	canClaimSetup: boolean;
	linkedGuilds: LinkedGuildStatus[];
	missingRequirements: string[];
}

export abstract class SetupService {
	static getStatus(userId?: string | null, db: DbClient = container.sqlite): SetupStatus {
		const currentConfig = db.select().from(config).limit(1).get();
		const customRoleCount = db
			.select({ value: count() })
			.from(guildStaffRolePermissions)
			.get();
		const guilds = this.listLinkedGuilds(db);
		const setupOwnerUserId = currentConfig?.setupOwnerUserId ?? null;
		const complete = Boolean(currentConfig?.onboardingCompletedAt);

		return {
			complete,
			hasCustomRbacConfig: (customRoleCount?.value ?? 0) > 0,
			primaryGuildId: currentConfig?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID ?? null,
			setupOwnerUserId,
			isSetupOwner: Boolean(userId && setupOwnerUserId === userId),
			canClaimSetup: !complete && !setupOwnerUserId,
			linkedGuilds: guilds,
			missingRequirements: this.getMissingRequirements(guilds)
		};
	}

	static claimSetupOwner(userId: string, db: DbClient = container.sqlite) {
		const now = new Date();

		return db.transaction((tx) => {
			const currentConfig = tx.select().from(config).limit(1).get();

			if (currentConfig?.onboardingCompletedAt) {
				return currentConfig;
			}

			if (currentConfig?.setupOwnerUserId && currentConfig.setupOwnerUserId !== userId) {
				return currentConfig;
			}

			if (!currentConfig) {
				tx.insert(config)
					.values({
						id: 1,
						setupOwnerUserId: userId,
						createdAt: now,
						updatedAt: now
					})
					.run();
			} else if (!currentConfig.setupOwnerUserId) {
				tx.update(config).set({ setupOwnerUserId: userId, updatedAt: now }).where(eq(config.id, currentConfig.id)).run();
			}

			AuditService.log(
				{
					action: AuditAction.ConfigUpdated,
					executedBy: userId,
					payload: { action: 'setup.owner.claimed' }
				},
				tx
			);

			return tx.select().from(config).limit(1).get();
		});
	}

	static canMutateSetup(userId: string, db: DbClient = container.sqlite) {
		const currentConfig = db.select().from(config).limit(1).get();

		if (!currentConfig?.setupOwnerUserId) return false;

		return currentConfig.setupOwnerUserId === userId;
	}

	static replaceLinkedGuilds(userId: string, guilds: LinkedGuildInput[], db: DbClient = container.sqlite) {
		const primaryGuild = guilds.find((guild) => guild.isPrimary);
		if (!primaryGuild) throw new Error('A primary guild is required');

		const now = new Date();

		db.transaction((tx) => {
			tx.delete(guildStaffRolePermissions).run();
			tx.delete(linkedGuilds).run();

			for (const guild of guilds) {
				tx.insert(linkedGuilds)
					.values({
						guildId: guild.guildId,
						name: guild.name,
						isPrimary: guild.isPrimary,
						createdAt: now,
						updatedAt: now
					})
					.run();
			}

			const currentConfig = tx.select().from(config).limit(1).get();

			if (!currentConfig) {
				tx.insert(config)
					.values({
						id: 1,
						primaryGuildId: primaryGuild.guildId,
						setupOwnerUserId: userId,
						createdAt: now,
						updatedAt: now
					})
					.run();
			} else {
				tx.update(config).set({ primaryGuildId: primaryGuild.guildId, updatedAt: now }).where(eq(config.id, currentConfig.id)).run();
			}

			AuditService.log(
				{
					action: AuditAction.ConfigUpdated,
					executedBy: userId,
					payload: {
						action: 'setup.guilds.updated',
						guildIds: guilds.map((guild) => guild.guildId),
						primaryGuildId: primaryGuild.guildId
					}
				},
				tx
			);
		});
	}

	static setChannelStrategy(
		userId: string,
		guildId: string,
		strategy: ChannelStrategyType,
		channelId: string,
		db: DbClient = container.sqlite
	) {
		const values =
			strategy === ChannelStrategy.Category
				? { channelStrategy: strategy, categoryChannelId: channelId, forumChannelId: null, updatedAt: new Date() }
				: { channelStrategy: strategy, categoryChannelId: null, forumChannelId: channelId, updatedAt: new Date() };

		db.transaction((tx) => {
			tx.update(linkedGuilds).set(values).where(eq(linkedGuilds.guildId, guildId)).run();
			AuditService.log(
				{
					action: AuditAction.ConfigUpdated,
					executedBy: userId,
					payload: { action: 'setup.channel_strategy.updated', guildId, strategy, channelId }
				},
				tx
			);
		});
	}

	static replaceRolePermissions(
		userId: string,
		guildId: string,
		roles: RolePermissionInput[],
		db: DbClient = container.sqlite
	) {
		const now = new Date();

		if (!roles.some((role) => role.permissions.includes(RbacPermission.Read))) {
			throw new Error('At least one role must grant READ');
		}

		db.transaction((tx) => {
			tx.delete(guildStaffRolePermissions).where(eq(guildStaffRolePermissions.guildId, guildId)).run();

			for (const role of roles) {
				tx.insert(guildStaffRolePermissions)
					.values({
						guildId,
						roleId: role.roleId,
						permissions: role.permissions,
						createdAt: now,
						updatedAt: now
					})
					.run();
			}

			AuditService.log(
				{
					action: AuditAction.ConfigUpdated,
					executedBy: userId,
					payload: {
						action: 'setup.role_permissions.updated',
						guildId,
						roleIds: roles.map((role) => role.roleId)
					}
				},
				tx
			);
		});
	}

	static complete(userId: string, db: DbClient = container.sqlite) {
		const status = this.getStatus(userId, db);
		if (status.missingRequirements.length > 0) {
			throw new Error(status.missingRequirements.join(', '));
		}

		db.transaction((tx) => {
			const currentConfig = tx.select().from(config).limit(1).get();
			if (!currentConfig) throw new Error('Setup has not been started');

			tx.update(config)
				.set({
					onboardingCompletedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(config.id, currentConfig.id))
				.run();

			AuditService.log(
				{
					action: AuditAction.ConfigUpdated,
					executedBy: userId,
					payload: { action: 'setup.completed' }
				},
				tx
			);
		});
	}

	static isGuildLinked(guildId: string, db: DbClient = container.sqlite) {
		const guild = db.select().from(linkedGuilds).where(eq(linkedGuilds.guildId, guildId)).limit(1).get();
		return Boolean(guild);
	}

	private static listLinkedGuilds(db: DbClient = container.sqlite): LinkedGuildStatus[] {
		const guilds = db.select().from(linkedGuilds).all();
		const rolePermissions = db.select().from(guildStaffRolePermissions).all();

		return guilds.map((guild) => ({
			guildId: guild.guildId,
			name: guild.name,
			isPrimary: guild.isPrimary,
			channelStrategy: guild.channelStrategy,
			categoryChannelId: guild.categoryChannelId,
			forumChannelId: guild.forumChannelId,
			rolePermissions: rolePermissions
				.filter((rolePermission) => rolePermission.guildId === guild.guildId)
				.map((rolePermission) => ({
					roleId: rolePermission.roleId,
					permissions: rolePermission.permissions as RbacPermissionType[]
				}))
		}));
	}

	private static getMissingRequirements(guilds: LinkedGuildStatus[]) {
		const missing: string[] = [];

		if (!guilds.some((guild) => guild.isPrimary)) {
			missing.push('primary_guild');
		}

		for (const guild of guilds) {
			if (guild.channelStrategy === ChannelStrategy.Category && !guild.categoryChannelId) {
				missing.push(`${guild.guildId}:category_channel`);
			} else if (guild.channelStrategy === ChannelStrategy.Forum && !guild.forumChannelId) {
				missing.push(`${guild.guildId}:forum_channel`);
			} else if (!guild.channelStrategy) {
				missing.push(`${guild.guildId}:channel_strategy`);
			}

			if (!guild.rolePermissions.some((role) => role.permissions.includes(RbacPermission.Read))) {
				missing.push(`${guild.guildId}:read_role`);
			}
		}

		return missing;
	}
}
