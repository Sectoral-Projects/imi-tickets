import { Route } from '@/lib/api/route';
import { Protected } from '@/lib/api/guards';
import type { ApiEnv } from '@/lib/api/context';
import { SettingsService } from '@/services/settings';
import { Context, Hono } from 'hono';
import { container } from '@sapphire/framework';
import type { GuildMember, Role } from 'discord.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export type DiscordUserRoleDto = {
	id: string;
	name: string;
	color: number;
	position: number;
};

function memberRoles(member: GuildMember): DiscordUserRoleDto[] {
	return [...member.roles.cache.values()]
		.filter((role) => role.id !== member.guild.id)
		.sort((a: Role, b: Role) => b.position - a.position)
		.map((role) => ({
			id: role.id,
			name: role.name,
			color: role.color,
			position: role.position
		}));
}

export default class DiscordUserRoute extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(`${path}/:userId`, (c) => this.getUser(c));
	}

	@Protected(['read'])
	async getUser(c: Context<ApiEnv>) {
		const userId = c.req.param('userId');
		if (!userId || !SNOWFLAKE_RE.test(userId)) {
			return c.json({ error: 'User unavailable', code: 'UNAVAILABLE' }, 404);
		}

		try {
			const user = await container.client.users.fetch(userId);
			const primaryGuildId = SettingsService.get()?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID ?? null;
			let nickname: string | null = null;
			let roles: DiscordUserRoleDto[] | null = null;

			if (primaryGuildId) {
				const guild = await container.client.guilds.fetch(primaryGuildId).catch(() => null);
				const member = await guild?.members.fetch(userId).catch(() => null);
				nickname = member?.nickname ?? null;
				// Member missing from guild → empty list; no primary guild → null (omit UI).
				roles = member ? memberRoles(member) : [];
			}

			const displayName = nickname ?? user.globalName ?? user.username;

			return c.json({
				userId: user.id,
				username: user.username,
				globalName: user.globalName,
				displayName,
				avatar: user.avatar,
				roles,
				unavailable: false
			});
		} catch {
			return c.json(
				{
					userId,
					username: null,
					globalName: null,
					displayName: null,
					avatar: null,
					roles: null,
					unavailable: true,
					error: 'User unavailable',
					code: 'UNAVAILABLE'
				},
				404
			);
		}
	}
}
