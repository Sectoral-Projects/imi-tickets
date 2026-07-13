import {
	ButtonStyle,
	ComponentType,
	type APIMessageTopLevelComponent,
	type APIComponentInContainer
} from 'discord.js';

export const StaffPageButtonPrefix = 'staff_page:';

export type StaffPageKind = 'logs' | 'blocked' | 'help' | 'snippets';

export type StaffPageState = {
	kind: StaffPageKind;
	page: number;
	context?: string;
};

export function buildStaffPageCustomId(kind: StaffPageKind, page: number, context?: string) {
	const encodedContext = context ? encodeURIComponent(context) : '';
	return `${StaffPageButtonPrefix}${kind}:${encodedContext}:${page}`;
}

export function parseStaffPageCustomId(customId: string): StaffPageState | null {
	if (!customId.startsWith(StaffPageButtonPrefix)) return null;

	const payload = customId.slice(StaffPageButtonPrefix.length);
	const [kind, encodedContext = '', pageRaw] = payload.split(':');
	if (kind !== 'logs' && kind !== 'blocked' && kind !== 'help' && kind !== 'snippets') return null;

	const page = Number(pageRaw);
	if (!Number.isInteger(page) || page < 0) return null;

	return {
		kind,
		page,
		context: encodedContext ? decodeURIComponent(encodedContext) : undefined
	};
}

export function paginationButtons(
	kind: StaffPageKind,
	page: number,
	totalPages: number,
	context?: string
): APIComponentInContainer[] {
	if (totalPages <= 1) return [];

	return [
		{
			type: ComponentType.ActionRow,
			components: [
				{
					type: ComponentType.Button,
					style: ButtonStyle.Secondary,
					label: 'Previous',
					custom_id: buildStaffPageCustomId(kind, page - 1, context),
					disabled: page <= 0
				},
				{
					type: ComponentType.Button,
					style: ButtonStyle.Secondary,
					label: 'Next',
					custom_id: buildStaffPageCustomId(kind, page + 1, context),
					disabled: page >= totalPages - 1
				}
			]
		}
	];
}

export function paginatedTextComponent(
	title: string,
	lines: string[],
	options: {
		kind: StaffPageKind;
		page: number;
		totalPages: number;
		context?: string;
	}
): APIMessageTopLevelComponent[] {
	const containerComponents: APIComponentInContainer[] = [
		{
			type: ComponentType.TextDisplay,
			content: `# ${title}`
		},
		{
			type: ComponentType.TextDisplay,
			content: lines.length > 0 ? lines.join('\n') : 'No results.'
		},
		...paginationButtons(options.kind, options.page, options.totalPages, options.context)
	];

	return [
		{
			type: ComponentType.Container,
			components: containerComponents
		}
	];
}
