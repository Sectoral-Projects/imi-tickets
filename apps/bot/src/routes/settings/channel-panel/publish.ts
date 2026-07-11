import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { ChannelPanelService } from '@/services/channelPanel';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class ChannelPanelPublish extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.post(path, (c) => this.publish(c));
	}

	@Protected(['manage'])
	async publish(c: Context<ApiEnv, string, BlankInput>) {
		try {
			const result = await ChannelPanelService.publish();
			const config = ChannelPanelService.getConfig();
			return c.json({
				...result,
				channelPanel: config
			});
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Failed to publish channel panel' },
				400
			);
		}
	}
}
