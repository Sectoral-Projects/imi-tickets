import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { MessageService } from '@/services/message';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class Messages extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getMessages(c));
		app.get(path + '/:messageId', (c) => this.getMessage(c));
	}

	@Protected()
	async getMessages(c: Context<ApiEnv, string, BlankInput>) {
		const threadIdParam = c.req.query('threadId');
		if (!threadIdParam || Number.isNaN(Number(threadIdParam))) {
			return c.json({ error: 'threadId query param is required and must be a number' }, 400);
		}

		const cursorParam = c.req.query('cursor');
		const cursor = cursorParam && !Number.isNaN(Number(cursorParam)) ? Number(cursorParam) : 0;

		const result = MessageService.listMessages({
			threadId: Number(threadIdParam),
			cursor
		});

		return c.json(result);
	}

	@Protected()
	async getMessage(c: Context<ApiEnv, string, BlankInput>) {
		const messageId = c.req.param('messageId');
		const message = MessageService.findById(Number(messageId));

		if (!message) {
			return c.json({ error: 'Message not found' }, 404);
		}

		return c.json(message);
	}
}