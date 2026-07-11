import { requireSetupOwner } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { SetupService } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class SetupGuildResources extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getResources(c));
	}

	async getResources(c: Context<ApiEnv, string, BlankInput>) {
		const denied = await requireSetupOwner(c);
		if (denied) return denied;

		const guildId = c.req.param('guildId');
		if (!guildId) {
			return c.json({ error: 'guildId is required' }, 400);
		}

		if (!SetupService.isGuildLinked(guildId)) {
			return c.json({ error: 'Guild is not linked' }, 404);
		}

		const botPresent = await DiscordSetupService.isBotPresent(guildId);
		if (!botPresent) {
			return c.json({ error: 'Bot is not present in this guild', code: 'BOT_NOT_PRESENT' }, 409);
		}

		return c.json(await DiscordSetupService.getGuildResources(guildId));
	}
}
