import type { ModalSubmitInteraction } from 'discord.js';
import type { ModalFieldConfig } from './types';
import { ModalFieldType } from './types';

export function extractModalTemplateVariables(
	fields: ModalFieldConfig[],
	interaction: ModalSubmitInteraction
): Record<string, unknown> {
	const vars: Record<string, unknown> = {};

	for (const field of fields) {
		vars[field.id] = readFieldValue(field, interaction);
	}

	return vars;
}

function readFieldValue(field: ModalFieldConfig, interaction: ModalSubmitInteraction) {
	switch (field.type) {
		case ModalFieldType.Text:
		case ModalFieldType.Paragraph:
			return interaction.fields.getTextInputValue(field.id);
		case ModalFieldType.StringSelect:
			return interaction.fields.getStringSelectValues(field.id).join(', ');
		case ModalFieldType.Radio:
			return interaction.fields.getRadioGroup(field.id, field.required ?? false) ?? '';
		case ModalFieldType.Checkbox:
			return interaction.fields.getCheckboxGroup(field.id).join(', ');
		case ModalFieldType.RoleSelect: {
			const roles = interaction.fields.getSelectedRoles(field.id, field.required ?? false);
			if (!roles || roles.size === 0) return '';
			return [...roles.values()]
				.filter((role): role is NonNullable<typeof role> => role != null)
				.map((role) => `<@&${role.id}>`)
				.join(', ');
		}
		default:
			return '';
	}
}
