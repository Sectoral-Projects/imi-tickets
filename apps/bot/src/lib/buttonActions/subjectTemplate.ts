import Mustache from 'mustache';
import { renderTimestamp } from '@/lib/components/util/templateVariables';
import type { User } from 'discord.js';

Mustache.escape = (value) => String(value ?? '');

export function renderSubjectTemplate(
	template: string | null | undefined,
	fallbackLabel: string,
	user: User,
	extraVars: Record<string, unknown> = {}
) {
	const trimmed = template?.trim();
	if (!trimmed) return fallbackLabel.trim() || 'Ticket';

	const rendered = Mustache.render(trimmed, {
		user: user.tag,
		userId: user.id,
		buttonLabel: fallbackLabel.trim(),
		timestamp: renderTimestamp(),
		...extraVars
	});

	const subject = rendered.trim();
	return subject.length > 0 ? subject.slice(0, 200) : fallbackLabel.trim() || 'Ticket';
}
