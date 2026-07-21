import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import {
	ChannelOpenButtonService,
	type ChannelOpenButton,
	type ChannelOpenButtonInput
} from '@/services/channelOpenButton';
import { ChannelPanelService } from '@/services/channelPanel';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class ChannelOpenButtons extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.listButtons(c));
		app.put(path, (c) => this.replaceButtons(c));
	}

	@Protected(['admin'])
	async listButtons(c: Context<ApiEnv, string, BlankInput>) {
		return c.json({ buttons: ChannelOpenButtonService.list().map(toButtonView) });
	}

	@Protected(['admin'])
	async replaceButtons(c: Context<ApiEnv, string, BlankInput>) {
		const body = await c.req.json<{ buttons?: ChannelOpenButtonInput[] }>().catch(() => null);
		if (!body || !Array.isArray(body.buttons)) {
			return c.json({ error: 'buttons array is required' }, 400);
		}

		try {
			const buttons = ChannelOpenButtonService.replaceAll(body.buttons).map(toButtonView);
			try {
				await ChannelPanelService.syncPublishedMessageIfLinked();
			} catch (syncError) {
				return c.json(
					{
						error:
							syncError instanceof Error
								? `Buttons saved, but Discord panel update failed: ${syncError.message}`
								: 'Buttons saved, but Discord panel update failed.',
						code: 'CHANNEL_PANEL_SYNC_FAILED',
						buttons
					},
					502
				);
			}
			return c.json({ buttons });
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Failed to update buttons' },
				400
			);
		}
	}
}

function toButtonView(button: ChannelOpenButton) {
	return {
		id: button.id,
		label: button.label,
		templateId: button.templateId,
		actionType: button.actionType,
		modalTemplateId: button.modalTemplateId ?? undefined,
		modal: button.modalConfig ?? undefined,
		optionalTag: button.optionalTag,
		subjectTemplate: button.subjectTemplate,
		sortOrder: button.sortOrder,
		enabled: button.enabled,
		updatedAt: button.updatedAt.toISOString()
	};
}
