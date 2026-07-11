import { requireSetupOwner } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { SetupService, type LinkedGuildInput } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

interface SaveGuildsBody {
	primaryGuildId?: string;
	additionalGuildIds?: string[];
}

export default class SetupGuilds extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.list(c));
		app.post(path, (c) => this.save(c));
	}

	async list(c: Context<ApiEnv, string, BlankInput>) {
		const denied = await requireSetupOwner(c);
		if (denied) return denied;

		try {
			const refresh = c.req.query('refresh') === 'true';
			const result = await DiscordSetupService.listAdminGuilds(c.get('user')!.id, { refresh });

			return c.json(result);
		} catch (error) {
			return c.json(
				{
					error: error instanceof Error ? error.message : 'Discord guild lookup failed',
					code: 'DISCORD_RATE_LIMITED'
				},
				503
			);
		}
	}

	async save(c: Context<ApiEnv, string, BlankInput>) {
		const denied = await requireSetupOwner(c);
		if (denied) return denied;

		const body = (await c.req.json()) as SaveGuildsBody;
		if (!body.primaryGuildId) {
			return c.json({ error: 'primaryGuildId is required' }, 400);
		}

		const availableGuilds = await DiscordSetupService.listAdminGuilds(c.get('user')!.id, { refresh: true });
		if (availableGuilds.needsReauth) {
			return c.json({ error: 'Discord guild access needs to be reauthorized', code: 'DISCORD_GUILDS_REAUTH_REQUIRED' }, 403);
		}

		const selectedIds = [body.primaryGuildId, ...(body.additionalGuildIds ?? [])];
		const uniqueSelectedIds = [...new Set(selectedIds)];
		const allowedGuilds = availableGuilds.guilds.filter((guild) => uniqueSelectedIds.includes(guild.id));

		if (allowedGuilds.length !== uniqueSelectedIds.length) {
			return c.json({ error: 'One or more selected guilds are not available to this user' }, 400);
		}

		const linkedGuilds: LinkedGuildInput[] = allowedGuilds.map((guild) => ({
			guildId: guild.id,
			name: guild.name,
			isPrimary: guild.id === body.primaryGuildId
		}));

		SetupService.replaceLinkedGuilds(c.get('user')!.id, linkedGuilds);

		return c.json(SetupService.getStatus(c.get('user')!.id));
	}
}
