import { Route } from '@/lib/api/route';
import { Hono } from 'hono';
import type { ApiEnv } from '@/lib/api/context';

export default class Heartbeat extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => c.text('ok'));
	}
}