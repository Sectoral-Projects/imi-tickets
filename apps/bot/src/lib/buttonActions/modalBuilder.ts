import {
	CheckboxGroupBuilder,
	CheckboxGroupOptionBuilder,
	LabelBuilder,
	ModalBuilder,
	RadioGroupBuilder,
	RadioGroupOptionBuilder,
	RoleSelectMenuBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextInputBuilder,
	TextInputStyle
} from 'discord.js';
import type { ModalConfig, ModalFieldConfig } from './types';
import { ModalFieldType } from './types';

const MAX_MODAL_FIELDS = 5;

export function buildDiscordModal(customId: string, config: ModalConfig) {
	const modal = new ModalBuilder().setCustomId(customId).setTitle(normalizeModalTitle(config.title));

	for (const field of config.fields.slice(0, MAX_MODAL_FIELDS)) {
		modal.addLabelComponents(buildLabel(field));
	}

	return modal;
}

function buildLabel(field: ModalFieldConfig) {
	const label = new LabelBuilder().setLabel(field.label);

	switch (field.type) {
		case ModalFieldType.Text:
			label.setTextInputComponent(buildTextInput(field, TextInputStyle.Short));
			break;
		case ModalFieldType.Paragraph:
			label.setTextInputComponent(buildTextInput(field, TextInputStyle.Paragraph));
			break;
		case ModalFieldType.StringSelect:
			label.setStringSelectMenuComponent(buildStringSelect(field));
			break;
		case ModalFieldType.Radio:
			label.setRadioGroupComponent(buildRadioGroup(field));
			break;
		case ModalFieldType.Checkbox:
			label.setCheckboxGroupComponent(buildCheckboxGroup(field));
			break;
		case ModalFieldType.RoleSelect:
			label.setRoleSelectMenuComponent(buildRoleSelect(field));
			break;
	}

	return label;
}

function buildTextInput(field: ModalFieldConfig, style: TextInputStyle) {
	const input = new TextInputBuilder()
		.setCustomId(field.id)
		.setStyle(style)
		.setRequired(field.required ?? false);

	if (field.placeholder) input.setPlaceholder(field.placeholder);
	if (field.minLength !== undefined) input.setMinLength(field.minLength);
	if (field.maxLength !== undefined) input.setMaxLength(field.maxLength);

	return input;
}

function buildStringSelect(field: ModalFieldConfig) {
	const select = new StringSelectMenuBuilder()
		.setCustomId(field.id)
		.setRequired(field.required ?? false)
		.setPlaceholder(field.placeholder ?? 'Choose an option')
		.setMinValues(field.minValues ?? 1)
		.setMaxValues(field.maxValues ?? 1)
		.setOptions(
			(field.options ?? []).map((option) => {
				const builder = new StringSelectMenuOptionBuilder()
					.setLabel(option.label)
					.setValue(option.value)
					.setDefault(option.default ?? false);
				if (option.description) builder.setDescription(option.description);
				return builder;
			})
		);

	return select;
}

function buildRadioGroup(field: ModalFieldConfig) {
	return new RadioGroupBuilder()
		.setCustomId(field.id)
		.setRequired(field.required ?? false)
		.setOptions(
			(field.options ?? []).map((option) => {
				const builder = new RadioGroupOptionBuilder()
					.setLabel(option.label)
					.setValue(option.value)
					.setDefault(option.default ?? false);
				if (option.description) builder.setDescription(option.description);
				return builder;
			})
		);
}

function buildCheckboxGroup(field: ModalFieldConfig) {
	return new CheckboxGroupBuilder()
		.setCustomId(field.id)
		.setRequired(field.required ?? false)
		.setMinValues(field.minValues ?? 0)
		.setMaxValues(field.maxValues ?? (field.options?.length ?? 1))
		.setOptions(
			(field.options ?? []).map((option) => {
				const builder = new CheckboxGroupOptionBuilder()
					.setLabel(option.label)
					.setValue(option.value)
					.setDefault(option.default ?? false);
				if (option.description) builder.setDescription(option.description);
				return builder;
			})
		);
}

function buildRoleSelect(field: ModalFieldConfig) {
	const select = new RoleSelectMenuBuilder()
		.setCustomId(field.id)
		.setRequired(field.required ?? false)
		.setPlaceholder(field.placeholder ?? 'Choose a role')
		.setMinValues(field.minValues ?? 1)
		.setMaxValues(field.maxValues ?? 1);

	return select;
}

function normalizeModalTitle(title: string) {
	const trimmed = title.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 45) : 'Form';
}
