import { guildStaffRolePermissions } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';
import { AuthService } from './auth';
import { SetupService } from './setup';
import type { DbClient } from './types';

export const RbacPermission = {
	Read: 'READ',
	Manage: 'MANAGE',
	Admin: 'ADMIN'
} as const;

export type RbacPermissionType = (typeof RbacPermission)[keyof typeof RbacPermission];

export interface ProductAccessResult {
	allowed: boolean;
	reason: 'allowed' | 'unauthenticated' | 'onboarding_required' | 'forbidden';
}

export abstract class RbacService {
	static async authorizeProductAccess(userId: string | null, permission: RbacPermissionType): Promise<ProductAccessResult> {
		if (!userId) {
			return { allowed: false, reason: 'unauthenticated' };
		}

		const setup = SetupService.getStatus();

		if (!setup.complete) {
			if (!setup.primaryGuildId || setup.hasCustomRbacConfig) {
				return { allowed: false, reason: 'onboarding_required' };
			}

			const discordUserId = AuthService.findDiscordUserId(userId);
			const isAdministrator = discordUserId ? await this.isGuildAdministrator(discordUserId, setup.primaryGuildId) : false;

			return isAdministrator
				? { allowed: true, reason: 'allowed' }
				: { allowed: false, reason: 'onboarding_required' };
		}

		if (!setup.primaryGuildId) {
			return { allowed: false, reason: 'onboarding_required' };
		}

		const discordUserId = AuthService.findDiscordUserId(userId);
		if (!discordUserId) {
			return { allowed: false, reason: 'forbidden' };
		}

		const hasPermission = await this.hasGuildPermission(discordUserId, setup.primaryGuildId, permission);

		return hasPermission
			? { allowed: true, reason: 'allowed' }
			: { allowed: false, reason: 'forbidden' };
	}

	static async hasGuildPermission(
		discordUserId: string,
		guildId: string,
		permission: RbacPermissionType,
		db: DbClient = container.sqlite,
		hint: { member?: GuildMember | null; roleIds?: string[]; administrator?: boolean } = {}
	) {
		const rolePermissions = db
			.select()
			.from(guildStaffRolePermissions)
			.where(eq(guildStaffRolePermissions.guildId, guildId))
			.all();

		const setup = SetupService.getStatus(undefined, db);
		const isPrimaryGuild = setup.primaryGuildId === guildId;

		if (hint.administrator && isPrimaryGuild) {
			return true;
		}

		const member = hint.member ?? (hint.roleIds ? null : await this.fetchGuildMember(discordUserId, guildId));
		if (!member && !hint.roleIds) return false;

		if (member && isPrimaryGuild && member.permissions.has(PermissionFlagsBits.Administrator)) {
			return true;
		}

		if (rolePermissions.length === 0) {
			return member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
		}

		const memberRoleIds = hint.roleIds ?? [...(member?.roles.cache.keys() ?? [])];

		return rolePermissions.some((rolePermission) => {
			return memberRoleIds.includes(rolePermission.roleId) && roleHasPermission(rolePermission.permissions, permission);
		});
	}

	static async isGuildAdministrator(discordUserId: string, guildId: string) {
		const member = await this.fetchGuildMember(discordUserId, guildId);
		return member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
	}

	private static async fetchGuildMember(discordUserId: string, guildId: string) {
		try {
			const guild = await container.client.guilds.fetch(guildId);
			return await guild.members.fetch(discordUserId);
		} catch {
			return null;
		}
	}
}

function roleHasPermission(granted: string[], required: RbacPermissionType) {
	if (granted.includes(RbacPermission.Admin)) return true;
	if (required === RbacPermission.Admin) return false;
	if (required === RbacPermission.Manage) {
		return granted.includes(RbacPermission.Manage);
	}
	// READ: granted by READ or MANAGE (ADMIN already returned above)
	return (
		granted.includes(RbacPermission.Read) ||
		granted.includes(RbacPermission.Manage)
	);
}
