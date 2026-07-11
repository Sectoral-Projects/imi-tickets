import { Route } from '@/lib/api/route';
import { getAuth } from '@/lib/auth';
import { Hono } from 'hono';
import type { ApiEnv } from '@/lib/api/context';

export default class Protected extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.on(['POST', 'GET'], `/api${path}`, (c) => getAuth().handler(c.req.raw));
	}
}
