import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { TicketService } from '@/services/ticket';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class Tickets extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getTickets(c));
		app.get(path + '/:ticketId', (c) => this.getTicket(c));
	}

	@Protected()
	async getTickets(c: Context<ApiEnv, string, BlankInput>) {
		const cursorParam = c.req.query('cursor');
		const cursor = cursorParam && !Number.isNaN(Number(cursorParam)) ? Number(cursorParam) : 0;
		const search = c.req.query('search')?.trim();
		const status = c.req.query('status')?.trim();
		const userId = c.req.query('userId')?.trim();

		const result = TicketService.listTickets({ cursor, search, status, userId });

		return c.json(result);
	}

	@Protected()
	async getTicket(c: Context<ApiEnv, string, BlankInput>) {
		const ticketId = c.req.param('ticketId');
		const ticket = TicketService.findById(Number(ticketId));

		if (!ticket) {
			return c.json({ error: 'Ticket not found' }, 404);
		}

		return c.json({
			...ticket,
			participants: TicketService.listEnrichedParticipants(ticket.id)
		});
	}
}