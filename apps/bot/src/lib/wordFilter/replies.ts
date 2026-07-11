import type { FieldWordFilter, WordFilterRule } from '@/lib/wordFilter/match';
import { evaluateFieldWordFilter } from '@/lib/wordFilter/match';
import type { ModalFieldConfig } from '@/lib/buttonActions/types';
import {
	APIMessageTopLevelComponent,
	ButtonStyle,
	Colors,
	ComponentType,
	Message,
	MessageFlags,
	type ButtonInteraction,
	type ModalSubmitInteraction
} from 'discord.js';

export function validateModalFieldsAgainstWordFilters(
	fields: ModalFieldConfig[],
	values: Record<string, unknown>
):
	| { ok: true }
	| {
			ok: false;
			fieldLabel: string;
			mode: 'blacklist' | 'whitelist';
			hit?: WordFilterRule;
			terms: string[];
	  } {
	for (const field of fields) {
		const raw = values[field.id];
		const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(String).join(' ') : '';
		const result = evaluateFieldWordFilter(text, field.wordFilter as FieldWordFilter | undefined);
		if (!result.ok) {
			return {
				ok: false,
				fieldLabel: field.label,
				mode: result.mode,
				hit: result.hit,
				terms: result.terms
			};
		}
	}
	return { ok: true };
}

export function buildDmWordBlacklistComponents(hit: WordFilterRule): APIMessageTopLevelComponent[] {
	return [
		{
			type: ComponentType.Container,
			accent_color: Colors.Red,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Message rejected'
				},
				{
					type: ComponentType.TextDisplay,
					content: `Your message was rejected due to restricted word usage (\`${hit.term}\`, ${hit.match} match). Please rephrase and try again.`
				}
			]
		}
	];
}

export function buildModalWordFilterRejectComponents(input: {
	fieldLabel: string;
	mode: 'blacklist' | 'whitelist';
	hit?: WordFilterRule;
	terms: string[];
	retryCustomId: string;
}): APIMessageTopLevelComponent[] {
	const termsList = input.terms.map((term) => `\`${term}\``).join(', ');
	const detail =
		input.mode === 'blacklist'
			? `**MUST NOT USE** restricted ${input.hit?.match ?? 'keyword'} content in **${input.fieldLabel}**${
					input.hit ? ` (matched \`${input.hit.term}\`)` : ''
				}. Avoid: ${termsList}`
			: `**MUST USE** one of the allowed values in **${input.fieldLabel}**: ${termsList}`;

	return [
		{
			type: ComponentType.Container,
			accent_color: Colors.Orange,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Submission rejected'
				},
				{
					type: ComponentType.TextDisplay,
					content: detail
				},
				{
					type: ComponentType.TextDisplay,
					content: 'Fix your answer, then press **Retry** to open the form again.'
				},
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.Button,
							style: ButtonStyle.Primary,
							label: 'Retry',
							custom_id: input.retryCustomId
						}
					]
				}
			]
		}
	];
}

export async function replyDmWordBlacklist(message: Message, hit: WordFilterRule) {
	await message.reply({
		components: buildDmWordBlacklistComponents(hit),
		flags: MessageFlags.IsComponentsV2
	});
}

export async function replyModalWordFilterReject(
	interaction: ModalSubmitInteraction,
	payload: {
		fieldLabel: string;
		mode: 'blacklist' | 'whitelist';
		hit?: WordFilterRule;
		terms: string[];
		retryCustomId: string;
	}
) {
	await interaction.reply({
		components: buildModalWordFilterRejectComponents(payload),
		flags: MessageFlags.IsComponentsV2,
		ephemeral: interaction.inGuild()
	});
}

export async function showModalRetryError(interaction: ButtonInteraction, content: string) {
	await interaction.reply({
		content,
		ephemeral: interaction.inGuild()
	});
}
