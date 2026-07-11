import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { SettingsService } from '@/services/settings';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class SettingsChannels extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getChannels(c));
	}

	@Protected()
	async getChannels(c: Context<ApiEnv, string, BlankInput>) {
		const view = await SettingsService.getView(c.get('user')?.id ?? null);
		if (!view.primaryGuildId) {
			return c.json({ error: 'Primary guild is not configured' }, 400);
		}

		const channels = await DiscordSetupService.getTextChannels(view.primaryGuildId);

		return c.json({
			guildId: view.primaryGuildId,
			channels
		});
	}
}
