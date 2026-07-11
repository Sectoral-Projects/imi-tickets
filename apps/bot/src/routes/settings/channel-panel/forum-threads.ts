import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { SettingsService } from '@/services/settings';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class ChannelPanelForumThreads extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getForumThreads(c));
	}

	@Protected()
	async getForumThreads(c: Context<ApiEnv, string, BlankInput>) {
		const channelId = c.req.query('channelId')?.trim();
		if (!channelId) {
			return c.json({ error: 'channelId is required' }, 400);
		}

		const view = await SettingsService.getView(c.get('user')?.id ?? null);
		if (!view.primaryGuildId) {
			return c.json({ error: 'Primary guild is not configured' }, 400);
		}

		const threads = await DiscordSetupService.getForumThreads(channelId);

		return c.json({
			guildId: view.primaryGuildId,
			channelId,
			threads
		});
	}
}
