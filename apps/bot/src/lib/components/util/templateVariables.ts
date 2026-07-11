import { time } from 'discord.js';

export const GLOBAL_TEMPLATE_VARIABLES = ['timestamp'] as const;

export function mergeGlobalTemplateVariables(variables: string[]) {
	return [...new Set([...variables, ...GLOBAL_TEMPLATE_VARIABLES])];
}

/** Discord client timestamp markup for live bot messages. */
export function renderTimestamp(date = new Date()) {
	return time(date, 'f');
}

/** Human-readable timestamp for staff UI previews. */
export function previewTimestamp(date = new Date(), locale: string | string[] = 'en-US') {
	const datePart = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
	const timePart = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
	return `${datePart} ${timePart}`;
}

export function withPreviewTimestamp(sampleVariables: Record<string, unknown> = {}) {
	return {
		...sampleVariables,
		timestamp: previewTimestamp()
	};
}
