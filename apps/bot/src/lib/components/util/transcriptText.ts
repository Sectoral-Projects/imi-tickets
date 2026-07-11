const TEXT_DISPLAY_TYPE = 10;

export function componentsToTranscriptText(components: unknown): string {
	const parts: string[] = [];
	collectTextParts(components, parts);
	return parts.join('\n\n').trim();
}

function collectTextParts(value: unknown, parts: string[]) {
	if (Array.isArray(value)) {
		for (const item of value) collectTextParts(item, parts);
		return;
	}

	if (!value || typeof value !== 'object') return;

	const record = value as Record<string, unknown>;
	if (record.type === TEXT_DISPLAY_TYPE && typeof record.content === 'string') {
		const text = record.content.trim();
		if (text.length > 0) parts.push(text);
	}

	if (Array.isArray(record.components)) {
		collectTextParts(record.components, parts);
	}
}
