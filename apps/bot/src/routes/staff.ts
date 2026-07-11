import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { StaffService, type StaffActionFilter } from '@/services/staff';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

const ACTION_FILTERS = new Set<StaffActionFilter>(['all', 'messages', 'closes', 'notes']);

export default class Staff extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getStaffAnalytics(c));
	}

	@Protected()
	async getStaffAnalytics(c: Context<ApiEnv, string, BlankInput>) {
		const search = c.req.query('search')?.trim();
		const actionParam = c.req.query('action')?.trim() as StaffActionFilter | undefined;
		const action = actionParam && ACTION_FILTERS.has(actionParam) ? actionParam : 'all';
		const from = c.req.query('from')?.trim();
		const to = c.req.query('to')?.trim();
		const daysParam = c.req.query('days');
		const days = daysParam && !Number.isNaN(Number(daysParam)) ? Number(daysParam) : 30;
		const staffUserId = c.req.query('staffUserId')?.trim();

		const result = StaffService.listAnalytics({
			search,
			action,
			days,
			from,
			to,
			staffUserId
		});

		return c.json(result);
	}
}
