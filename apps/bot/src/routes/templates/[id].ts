import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { MessageTemplateService, type UpdateMessageTemplateInput } from '@/services/messageTemplate';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class TemplateById extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getTemplate(c));
		app.patch(path, (c) => this.updateTemplate(c));
		app.delete(path, (c) => this.deleteTemplate(c));
		app.post(`${path}/preview`, (c) => this.previewTemplate(c));
	}

	@Protected(['admin'])
	async getTemplate(c: Context<ApiEnv, string, BlankInput>) {
		const id = c.req.param('id');
		if (!id) return c.json({ error: 'Template id is required' }, 400);
		const template = MessageTemplateService.get(id);
		if (!template) return c.json({ error: 'Template not found' }, 404);
		return c.json(template);
	}

	@Protected(['admin'])
	async updateTemplate(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<UpdateMessageTemplateInput>().catch(() => null);
		if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

		try {
			const id = c.req.param('id');
			if (!id) return c.json({ error: 'Template id is required' }, 400);
			return c.json(MessageTemplateService.update(c.get('user')!.id, id, body));
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Failed to update template' }, 400);
		}
	}

	@Protected(['admin'])
	async deleteTemplate(c: Context<ApiEnv, string, BlankInput>) {
		const id = c.req.param('id');
		if (!id) return c.json({ error: 'Template id is required' }, 400);
		const deleted = MessageTemplateService.delete(c.get('user')!.id, id);
		if (!deleted) return c.json({ error: 'Template not found' }, 404);
		return c.json({ deleted: true });
	}

	@Protected(['admin'])
	async previewTemplate(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<{ template?: unknown; vars?: Record<string, unknown> }>().catch(() => null);
		if (!body || body.template === undefined) return c.json({ error: 'Template is required' }, 400);

		try {
			return c.json({ components: MessageTemplateService.preview(body.template, body.vars ?? {}) });
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Failed to preview template' }, 400);
		}
	}
}
