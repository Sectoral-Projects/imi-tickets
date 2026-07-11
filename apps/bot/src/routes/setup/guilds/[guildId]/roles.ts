import { requireSetupOwner } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { RbacPermission, type RbacPermissionType } from '@/services/rbac';
import { SetupService, type RolePermissionInput } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

interface RolesBody {
	roles?: RolePermissionInput[];
}

const validPermissions = new Set<string>([RbacPermission.Read, RbacPermission.Manage, RbacPermission.Admin]);

export default class SetupGuildRoles extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.put(path, (c) => this.update(c));
	}

	async update(c: Context<ApiEnv, string, BlankInput>) {
		const denied = await requireSetupOwner(c);
		if (denied) return denied;

		const guildId = c.req.param('guildId');
		const body = (await c.req.json()) as RolesBody;

		if (!guildId) {
			return c.json({ error: 'guildId is required' }, 400);
		}

		if (!SetupService.isGuildLinked(guildId)) {
			return c.json({ error: 'Guild is not linked' }, 404);
		}

		if (!body.roles || body.roles.length === 0) {
			return c.json({ error: 'At least one role is required' }, 400);
		}

		const resources = await DiscordSetupService.getGuildResources(guildId);
		const availableRoleIds = new Set(resources.roles.map((role) => role.id));
		const roles = body.roles.map((role) => ({
			roleId: role.roleId,
			permissions: role.permissions.map((permission) => permission.toUpperCase() as RbacPermissionType)
		}));

		for (const role of roles) {
			if (!availableRoleIds.has(role.roleId)) {
				return c.json({ error: 'Selected role is not available in this guild' }, 400);
			}

			if (role.permissions.length === 0 || role.permissions.some((permission) => !validPermissions.has(permission))) {
				return c.json({ error: 'Invalid role permissions' }, 400);
			}
		}

		try {
			SetupService.replaceRolePermissions(c.get('user')!.id, guildId, roles);
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Invalid role permissions' }, 400);
		}

		return c.json(SetupService.getStatus(c.get('user')!.id));
	}
}
