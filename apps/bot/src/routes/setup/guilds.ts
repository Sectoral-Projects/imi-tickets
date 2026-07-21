import { requireSetupOwner } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { SetupService } from '@/services/setup';
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

		const primary = availableGuilds.guilds.find((guild) => guild.id === body.primaryGuildId);
		if (!primary) {
			return c.json({ error: 'The selected primary guild is not available to this user' }, 400);
		}

		// Only the primary guild is linked for setup. Other servers are inferred from bot presence.
		SetupService.replaceLinkedGuilds(c.get('user')!.id, [
			{
				guildId: primary.id,
				name: primary.name,
				isPrimary: true
			}
		]);

		return c.json(SetupService.getStatus(c.get('user')!.id));
	}
}
