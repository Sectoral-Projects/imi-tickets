import type {
	ButtonActionConfig,
	ButtonMessageDelivery,
	ModalConfig,
	ModalFieldConfig,
	ModalFieldOption
} from './types';
import { ButtonActionType, ButtonMessageDelivery as Delivery, ModalFieldType } from './types';
import { normalizeFieldWordFilter } from '@/lib/wordFilter/match';

const FIELD_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/i;
const MAX_MODAL_FIELDS = 5;
const MAX_OPTIONS = 25;

const MESSAGE_DELIVERY_VALUES = new Set<string>(Object.values(Delivery));

export function normalizeButtonActionConfig(input: ButtonActionConfig): ButtonActionConfig {
	const actionType = input.actionType === ButtonActionType.Modal ? ButtonActionType.Modal : ButtonActionType.Message;
	const templateId = normalizeOptionalId(input.templateId);
	const closeTicketOnPress = Boolean(input.closeTicketOnPress);
	const messageDelivery = normalizeMessageDelivery(input.messageDelivery, Boolean(templateId));

	if (actionType === ButtonActionType.Message) {
		if (!templateId && !closeTicketOnPress) {
			throw new Error('Linked template is required for message buttons');
		}
		return {
			actionType,
			...(templateId ? { templateId, messageDelivery } : {}),
			...(closeTicketOnPress ? { closeTicketOnPress: true } : {})
		};
	}

	const modalTemplateId = normalizeOptionalId(input.modalTemplateId);
	const modal = normalizeModalConfig(input.modal);
	if (!modalTemplateId && !modal) {
		throw new Error('Modal template is required for modal buttons');
	}

	return {
		actionType,
		...(templateId ? { templateId, messageDelivery } : {}),
		modalTemplateId,
		modal: modal ?? undefined,
		...(closeTicketOnPress ? { closeTicketOnPress: true } : {})
	};
}

export function normalizeTemplateButtonActions(
	input: Record<string, ButtonActionConfig> | null | undefined
): Record<string, ButtonActionConfig> {
	if (!input) return {};

	const normalized: Record<string, ButtonActionConfig> = {};
	for (const [buttonId, config] of Object.entries(input)) {
		const trimmedId = buttonId.trim();
		if (!FIELD_ID_PATTERN.test(trimmedId)) {
			throw new Error(`Button id ${buttonId} is invalid for button actions`);
		}
		normalized[trimmedId] = normalizeButtonActionConfig(config);
	}

	return normalized;
}

export function normalizeModalConfig(input: ModalConfig | null | undefined): ModalConfig | null {
	if (!input) return null;

	const title = input.title.trim();
	if (title.length === 0) throw new Error('Modal title is required');
	if (title.length > 45) throw new Error('Modal title must be 45 characters or less');

	const fields = input.fields.slice(0, MAX_MODAL_FIELDS).map(normalizeModalField);
	if (fields.length === 0) throw new Error('Modal must include at least one field');

	return { title, fields };
}

function normalizeMessageDelivery(
	value: ButtonMessageDelivery | string | null | undefined,
	hasLinkedTemplate: boolean
): ButtonMessageDelivery | undefined {
	if (!hasLinkedTemplate) return undefined;
	if (typeof value === 'string' && MESSAGE_DELIVERY_VALUES.has(value)) {
		return value as ButtonMessageDelivery;
	}
	return Delivery.PresserAndStaff;
}

function normalizeModalField(field: ModalFieldConfig): ModalFieldConfig {
	const id = field.id.trim();
	const label = field.label.trim();
	if (!FIELD_ID_PATTERN.test(id)) {
		throw new Error('Modal field id must be 1-40 characters and use letters, numbers, underscore, or dash');
	}
	if (label.length === 0) throw new Error('Modal field label is required');
	if (label.length > 45) throw new Error('Modal field label must be 45 characters or less');

	const type = Object.values(ModalFieldType).includes(field.type) ? field.type : ModalFieldType.Text;
	const normalized: ModalFieldConfig = { id, label, type };

	if (field.required !== undefined) normalized.required = field.required;
	if (field.placeholder?.trim()) normalized.placeholder = field.placeholder.trim().slice(0, 100);

	const wordFilter = normalizeFieldWordFilter(field.wordFilter);
	if (wordFilter) normalized.wordFilter = wordFilter;

	if (type === ModalFieldType.Text || type === ModalFieldType.Paragraph) {
		if (field.minLength !== undefined) normalized.minLength = field.minLength;
		if (field.maxLength !== undefined) normalized.maxLength = field.maxLength;
		return normalized;
	}

	if (type === ModalFieldType.RoleSelect) {
		normalized.minValues = field.minValues ?? 1;
		normalized.maxValues = field.maxValues ?? 1;
		return normalized;
	}

	const options = normalizeOptions(field.options);
	if (options.length === 0) {
		throw new Error(`Modal field ${id} requires at least one option`);
	}

	normalized.options = options;
	if (type === ModalFieldType.Checkbox) {
		normalized.minValues = field.minValues ?? 0;
		normalized.maxValues = field.maxValues ?? options.length;
	} else if (type === ModalFieldType.StringSelect) {
		normalized.minValues = field.minValues ?? 1;
		normalized.maxValues = field.maxValues ?? 1;
	}

	return normalized;
}

function normalizeOptions(options: ModalFieldOption[] | undefined) {
	return (options ?? [])
		.slice(0, MAX_OPTIONS)
		.map((option, index) => {
			const label = option.label.trim();
			const value = option.value.trim();
			if (label.length === 0) throw new Error(`Option ${index + 1} label is required`);
			if (value.length === 0) throw new Error(`Option ${index + 1} value is required`);
			return {
				label: label.slice(0, 100),
				value: value.slice(0, 100),
				description: option.description?.trim() ? option.description.trim().slice(0, 100) : undefined,
				default: option.default ?? false
			};
		});
}

function normalizeOptionalId(value: string | null | undefined) {
	if (value == null) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
