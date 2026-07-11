import { dmOpenButtons, messageTemplates } from '@/database/sqlite/schema';
import { SYSTEM_COMPONENT_IDS } from '@/lib/components/registry';
import { ButtonActionType, type ModalConfig } from '@/lib/buttonActions/types';
import { normalizeButtonActionConfig } from '@/lib/buttonActions/normalize';
import { container } from '@sapphire/framework';
import {
	ButtonStyle,
	ComponentType,
	type APIActionRowComponent,
	type APIButtonComponentWithCustomId,
	type APIMessageTopLevelComponent
} from 'discord.js';
import { asc, eq, inArray } from 'drizzle-orm';
import type { DbClient } from './types';
import { buildEmbeddedModalButtonCustomId } from '@/lib/buttonActions/customIds';

export const DmButtonCustomIdPrefix = {
	Open: 'dm_open:'
} as const;

export interface DmOpenButtonInput {
	id: string;
	label: string;
	templateId?: string;
	actionType?: ButtonActionType;
	modalTemplateId?: string;
	modal?: ModalConfig;
	optionalTag?: string | null;
	sortOrder?: number;
	enabled?: boolean;
}

export type DmOpenButton = typeof dmOpenButtons.$inferSelect;

export abstract class DmOpenButtonService {
	static list(db: DbClient = container.sqlite) {
		return db.select().from(dmOpenButtons).orderBy(asc(dmOpenButtons.sortOrder), asc(dmOpenButtons.label)).all();
	}

	static listEnabled(db: DbClient = container.sqlite) {
		return this.list(db).filter((button) => button.enabled);
	}

	static find(id: string, db: DbClient = container.sqlite) {
		return db.select().from(dmOpenButtons).where(eq(dmOpenButtons.id, id)).limit(1).get();
	}

	static replaceAll(input: DmOpenButtonInput[], db: DbClient = container.sqlite) {
		return db.transaction((tx) => {
			const now = new Date();
			tx.delete(dmOpenButtons).run();

			if (input.length === 0) return [];

			const templateIds = [
				...new Set(
					input.flatMap((button) => {
						const ids: string[] = [];
						const messageId = button.templateId?.trim();
						const modalId = button.modalTemplateId?.trim();
						if (messageId) ids.push(messageId);
						if (modalId) ids.push(modalId);
						return ids;
					})
				)
			];
			const templates = tx
				.select({ id: messageTemplates.id })
				.from(messageTemplates)
				.where(inArray(messageTemplates.id, templateIds))
				.all();
			const existingTemplateIds = new Set(templates.map((template) => template.id));

			const values = input.map((button, index) => {
				const id = normalizeButtonId(button.id);
				const actionType =
					button.actionType === ButtonActionType.Modal ? ButtonActionType.Modal : ButtonActionType.Message;
				const templateId = normalizeOptionalTemplateId(button.templateId);

				if (actionType === ButtonActionType.Modal) {
					const normalizedAction = normalizeButtonActionConfig({
						actionType,
						templateId: button.templateId,
						modalTemplateId: button.modalTemplateId,
						modal: button.modal
					});

					if (normalizedAction.templateId && !existingTemplateIds.has(normalizedAction.templateId) && !SYSTEM_COMPONENT_IDS.has(normalizedAction.templateId)) {
						throw new Error(`Template ${normalizedAction.templateId} does not exist`);
					}

					if (normalizedAction.modalTemplateId && !existingTemplateIds.has(normalizedAction.modalTemplateId) && !SYSTEM_COMPONENT_IDS.has(normalizedAction.modalTemplateId)) {
						throw new Error(`Modal template ${normalizedAction.modalTemplateId} does not exist`);
					}

					return {
						id,
						label: normalizeLabel(button.label),
						templateId: normalizedAction.templateId ?? '',
						actionType: normalizedAction.actionType,
						modalTemplateId: normalizedAction.modalTemplateId ?? null,
						modalConfig: normalizedAction.modal ?? null,
						optionalTag: normalizeOptionalTag(button.optionalTag),
						sortOrder: button.sortOrder ?? index,
						enabled: button.enabled ?? true,
						updatedAt: now
					};
				}

				if (templateId && !existingTemplateIds.has(templateId) && !SYSTEM_COMPONENT_IDS.has(templateId)) {
					throw new Error(`Template ${templateId} does not exist`);
				}

				return {
					id,
					label: normalizeLabel(button.label),
					templateId: templateId ?? '',
					actionType: ButtonActionType.Message,
					modalTemplateId: null,
					modalConfig: null,
					optionalTag: normalizeOptionalTag(button.optionalTag),
					sortOrder: button.sortOrder ?? index,
					enabled: button.enabled ?? true,
					updatedAt: now
				};
			});

			tx.insert(dmOpenButtons).values(values).run();
			return tx.select().from(dmOpenButtons).orderBy(asc(dmOpenButtons.sortOrder), asc(dmOpenButtons.label)).all();
		});
	}

	static buildActionRow(
		buttons: DmOpenButton[],
		customIdPrefix: (typeof DmButtonCustomIdPrefix)[keyof typeof DmButtonCustomIdPrefix]
	) {
		const components: APIButtonComponentWithCustomId[] = buttons.slice(0, 5).map((button) => ({
			type: ComponentType.Button,
			style: ButtonStyle.Secondary,
			label: button.label,
			custom_id: `${customIdPrefix}${button.id}`
		}));

		if (components.length === 0) return null;

		return {
			type: ComponentType.ActionRow,
			components
		} satisfies APIActionRowComponent<APIButtonComponentWithCustomId>;
	}

	static appendButtonsToComponents(
		components: APIMessageTopLevelComponent[],
		buttons: DmOpenButton[],
		customIdPrefix: (typeof DmButtonCustomIdPrefix)[keyof typeof DmButtonCustomIdPrefix]
	): APIMessageTopLevelComponent[] {
		const row = this.buildActionRow(buttons, customIdPrefix);
		if (!row) return components;

		const [first, ...rest] = components;
		if (first && 'components' in first && Array.isArray(first.components)) {
			const firstWithComponents = first as APIMessageTopLevelComponent & { components: unknown[] };
			return [
				{
					...first,
					components: [...firstWithComponents.components, row]
				} as APIMessageTopLevelComponent,
				...rest
			];
		}

		return [...components, row as APIMessageTopLevelComponent];
	}
}

export { buildEmbeddedModalButtonCustomId };

function normalizeButtonId(id: string) {
	const trimmed = id.trim();
	if (!/^[a-z0-9][a-z0-9_-]{1,31}$/i.test(trimmed)) {
		throw new Error('Button id must be 2-32 characters and use letters, numbers, underscore, or dash');
	}
	return trimmed;
}

function normalizeLabel(label: string) {
	const trimmed = label.trim();
	if (trimmed.length === 0) throw new Error('Button label is required');
	if (trimmed.length > 80) throw new Error('Button label must be 80 characters or less');
	return trimmed;
}

function normalizeOptionalTag(tag: string | null | undefined) {
	if (tag == null) return null;
	const trimmed = tag.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalTemplateId(value: string | null | undefined) {
	if (value == null) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
