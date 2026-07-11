import { messageTemplates } from '@/database/sqlite/schema';
import { ButtonActionType, type ButtonActionConfig } from '@/lib/buttonActions/types';
import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import { DmOpenButtonService } from './dmOpenButton';
import { ModalTemplateService } from './modalTemplate';
import type { DbClient } from './types';

export abstract class ButtonActionService {
	static getEmbedded(templateId: string, buttonId: string, db: DbClient = container.sqlite): ButtonActionConfig | null {
		const row = db.select().from(messageTemplates).where(eq(messageTemplates.id, templateId)).limit(1).get();
		const actions = row?.buttonActions ?? {};
		return actions[buttonId] ?? null;
	}

	static getDmOpen(buttonId: string, db: DbClient = container.sqlite): ButtonActionConfig | null {
		const button = DmOpenButtonService.find(buttonId, db);
		if (!button) return null;

		const actionType =
			button.actionType === ButtonActionType.Modal ? ButtonActionType.Modal : ButtonActionType.Message;

		if (actionType === ButtonActionType.Modal) {
			return {
				actionType,
				templateId: button.templateId.trim() || undefined,
				modalTemplateId: button.modalTemplateId?.trim() || undefined,
				modal: button.modalConfig ?? undefined
			};
		}

		return {
			actionType,
			templateId: button.templateId
		};
	}

	static resolveModal(action: ButtonActionConfig | null, db: DbClient = container.sqlite) {
		if (!action || action.actionType !== ButtonActionType.Modal) return null;
		return ModalTemplateService.resolveModalConfig(action.modalTemplateId, action.modal ?? null, db);
	}
}
