import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { AutoCloseService } from '@/services/autoClose';
import { SettingsService, type UpdateSettingsInput } from '@/services/settings';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class Settings extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getSettings(c));
		app.patch(path, (c) => this.patchSettings(c));
	}

	@Protected()
	async getSettings(c: Context<ApiEnv, string, BlankInput>) {
		const view = await SettingsService.getView(c.get('user')?.id ?? null);
		return c.json(view);
	}

	@Protected(['manage'])
	async patchSettings(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<UpdateSettingsInput>().catch(() => null);
		if (!body) {
			return c.json({ error: 'Invalid JSON body' }, 400);
		}

		try {
			const updated = SettingsService.update(c.get('user')!.id, body);
			AutoCloseService.wake();
			const view = await SettingsService.getView(c.get('user')!.id);
			return c.json({
				...view,
				settings: updated.settings,
				logChannelId: updated.logChannelId,
				transcriptChannelId: updated.transcriptChannelId,
				channelPanel: {
					...view.channelPanel,
					...updated.channelPanel
				}
			});
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Failed to update settings' },
				400
			);
		}
	}
}
