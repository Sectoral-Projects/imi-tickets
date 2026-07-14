import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import {
	WhitelabelService,
	type UpdateWhitelabelInput,
	type WhitelabelActivityType
} from '@/services/whitelabel';
import type { ApiEnv } from '@/lib/api/context';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';

export default class SettingsWhitelabel extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getWhitelabel(c));
		app.patch(path, (c) => this.patchWhitelabel(c));
	}

	@Protected(['admin'])
	async getWhitelabel(c: Context<ApiEnv, string, BlankInput>) {
		const guildId = c.req.query('guildId')?.trim() || null;
		try {
			const view = await WhitelabelService.getView(guildId);
			return c.json(view);
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Failed to load whitelabel settings' },
				400
			);
		}
	}

	@Protected(['admin'])
	async patchWhitelabel(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<UpdateWhitelabelInput>().catch(() => null);
		if (!body || typeof body !== 'object') {
			return c.json({ error: 'Invalid JSON body' }, 400);
		}

		if (!body.guildId || typeof body.guildId !== 'string') {
			return c.json({ error: 'guildId is required' }, 400);
		}

		if (body.activityType !== undefined && !isActivityType(body.activityType)) {
			return c.json({ error: 'Invalid activityType' }, 400);
		}

		try {
			const view = await WhitelabelService.update(c.get('user')!.id, body);
			return c.json(view);
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Failed to update whitelabel settings' },
				400
			);
		}
	}
}

function isActivityType(value: unknown): value is WhitelabelActivityType {
	return (
		value === 'playing' ||
		value === 'listening' ||
		value === 'watching' ||
		value === 'competing' ||
		value === 'custom'
	);
}
