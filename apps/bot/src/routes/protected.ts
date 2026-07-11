import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { Context, Hono } from 'hono';
import type { ApiEnv } from '@/lib/api/context';
import { BlankInput } from 'hono/types';

export default class ProtectedRoute extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getProtected(c));
	}

	@Protected()
	async getProtected(c: Context<ApiEnv, string, BlankInput>) {
		return c.text('protected');
	}
}