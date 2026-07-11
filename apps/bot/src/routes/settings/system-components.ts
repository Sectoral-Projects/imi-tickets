import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { MessageTemplateService } from '@/services/messageTemplate';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class SystemComponents extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.listSystemComponents(c));
	}

	@Protected(['admin'])
	async listSystemComponents(c: Context<ApiEnv, string, BlankInput>) {
		return c.json({ components: MessageTemplateService.listSystemComponents() });
	}
}
