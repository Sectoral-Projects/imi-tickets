import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { TicketService } from '@/services/ticket';
import { TimelineService } from '@/services/timeline';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class TicketTimeline extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getTimeline(c));
	}

	@Protected()
	async getTimeline(c: Context<ApiEnv, string, BlankInput>) {
		const ticketId = Number(c.req.param('ticketId'));
		if (Number.isNaN(ticketId)) {
			return c.json({ error: 'ticketId must be a number' }, 400);
		}

		const ticket = TicketService.findById(ticketId);
		if (!ticket) {
			return c.json({ error: 'Ticket not found' }, 404);
		}

		const cursorParam = c.req.query('cursor');
		const cursor = cursorParam && !Number.isNaN(Number(cursorParam)) ? Number(cursorParam) : 0;
		const messageIdParam = c.req.query('messageId');
		const messageId = messageIdParam && !Number.isNaN(Number(messageIdParam)) ? Number(messageIdParam) : undefined;
		const windowCursor = c.req.query('windowCursor')?.trim();
		const directionParam = c.req.query('direction')?.trim();
		const direction = directionParam === 'older' || directionParam === 'newer' ? directionParam : undefined;
		const limitParam = c.req.query('limit');
		const limit = limitParam && !Number.isNaN(Number(limitParam)) ? Number(limitParam) : undefined;

		if (messageId || (windowCursor && direction)) {
			const result = TimelineService.listTimelineWindow({
				threadId: ticketId,
				messageId,
				cursor: windowCursor,
				direction,
				limit
			});

			return c.json(result);
		}

		const result = TimelineService.listTimeline({
			threadId: ticketId,
			cursor,
			limit
		});

		return c.json(result);
	}
}
