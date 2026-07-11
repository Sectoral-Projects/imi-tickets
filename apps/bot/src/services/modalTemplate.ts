import { messageTemplates } from '@/database/sqlite/schema';
import { normalizeModalConfig } from '@/lib/buttonActions/normalize';
import type { ModalConfig } from '@/lib/buttonActions/types';
import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import type { DbClient } from './types';

export const MODAL_TEMPLATE_CATEGORY = 'modal';

export abstract class ModalTemplateService {
	static isModalCategory(category: string | null | undefined) {
		return category === MODAL_TEMPLATE_CATEGORY;
	}

	static getConfig(templateId: string, db: DbClient = container.sqlite): ModalConfig | null {
		const row = db.select().from(messageTemplates).where(eq(messageTemplates.id, templateId)).limit(1).get();
		if (!row || !this.isModalCategory(row.category)) return null;

		try {
			const parsed = typeof row.template === 'string' ? JSON.parse(row.template) : row.template;
			return normalizeModalConfig(parsed as ModalConfig);
		} catch {
			return null;
		}
	}

	static resolveModalConfig(
		modalTemplateId: string | null | undefined,
		inlineModal: ModalConfig | null | undefined,
		db: DbClient = container.sqlite
	): ModalConfig | null {
		const linkedId = modalTemplateId?.trim();
		if (linkedId) {
			const linked = this.getConfig(linkedId, db);
			if (linked) return linked;
		}

		return normalizeModalConfig(inlineModal ?? null);
	}
}
