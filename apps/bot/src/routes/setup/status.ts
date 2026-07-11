import { requireSession } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { SetupService } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class SetupStatus extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getStatus(c));
	}

	async getStatus(c: Context<ApiEnv, string, BlankInput>) {
		const denied = requireSession(c);
		if (denied) return denied;

		return c.json(SetupService.getStatus(c.get('user')?.id));
	}
}
