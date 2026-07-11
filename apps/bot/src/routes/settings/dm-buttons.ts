import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DmOpenButtonService, type DmOpenButton, type DmOpenButtonInput } from '@/services/dmOpenButton';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class DmButtons extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.listButtons(c));
		app.put(path, (c) => this.replaceButtons(c));
	}

	@Protected()
	async listButtons(c: Context<ApiEnv, string, BlankInput>) {
		return c.json({ buttons: DmOpenButtonService.list().map(toButtonView) });
	}

	@Protected(['manage'])
	async replaceButtons(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<{ buttons?: DmOpenButtonInput[] }>().catch(() => null);
		if (!body || !Array.isArray(body.buttons)) {
			return c.json({ error: 'buttons array is required' }, 400);
		}

		try {
			return c.json({ buttons: DmOpenButtonService.replaceAll(body.buttons).map(toButtonView) });
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Failed to update buttons' }, 400);
		}
	}
}

function toButtonView(button: DmOpenButton) {
	return {
		id: button.id,
		label: button.label,
		templateId: button.templateId,
		actionType: button.actionType,
		modalTemplateId: button.modalTemplateId ?? undefined,
		modal: button.modalConfig ?? undefined,
		optionalTag: button.optionalTag,
		sortOrder: button.sortOrder,
		enabled: button.enabled,
		updatedAt: button.updatedAt.toISOString()
	};
}
