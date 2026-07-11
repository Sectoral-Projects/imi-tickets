import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { isDiscordUserId } from '@/lib/dataPrivacy/userReferences';
import { AuditAction, AuditService } from '@/services/audit';
import { GdprService } from '@/services/gdpr';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class GdprUserExport extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.exportUser(c));
	}

	@Protected(['admin'])
	async exportUser(c: Context<ApiEnv, string, BlankInput>) {
		const userId = c.req.param('userId')?.trim();
		if (!userId || !isDiscordUserId(userId)) {
			return c.json({ error: 'A valid Discord user ID is required' }, 400);
		}

		const payload = GdprService.exportUser(userId);
		AuditService.log({
			action: AuditAction.GdprExported,
			executedBy: c.get('user')!.id,
			userId,
			payload: {
				subjectUserId: userId,
				ticketCount: payload.tickets.length,
				messageCount: payload.messages.length
			}
		});

		c.header('Content-Type', 'application/json; charset=utf-8');
		c.header('Content-Disposition', `attachment; filename="gdpr-export-${userId}.json"`);
		return c.body(JSON.stringify(payload, null, 2));
	}
}
