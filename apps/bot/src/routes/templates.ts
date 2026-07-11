import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { MessageTemplateService, type SaveMessageTemplateInput } from '@/services/messageTemplate';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class Templates extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.listTemplates(c));
		app.post(path, (c) => this.createTemplate(c));
	}

	@Protected(['admin'])
	async listTemplates(c: Context<ApiEnv, string, BlankInput>) {
		const search = c.req.query('search')?.trim();
		return c.json({ templates: MessageTemplateService.list({ search }) });
	}

	@Protected(['admin'])
	async createTemplate(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<SaveMessageTemplateInput>().catch(() => null);
		if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

		try {
			return c.json(MessageTemplateService.create(c.get('user')!.id, body), 201);
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Failed to create template' }, 400);
		}
	}
}
