export type ParseDurationOrDateResult =
	| { ok: true; at: Date; kind: 'duration' | 'date' }
	| { ok: false; error: string };

const DURATION_TOKEN =
	/(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/gi;

/**
 * Parses relative durations and calendar dates into an absolute Date.
 * Durations are relative to `now`. Dates without a time use local midnight.
 */
export function parseDurationOrDate(
	input: string,
	now: Date = new Date()
): ParseDurationOrDateResult {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: false, error: 'Expected a duration or date.' };
	}

	const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
	if (dateMatch) {
		return parseCalendarDate(dateMatch, now);
	}

	return parseDuration(trimmed, now);
}

function parseCalendarDate(match: RegExpMatchArray, now: Date): ParseDurationOrDateResult {
	const month = Number(match[1]);
	const day = Number(match[2]);
	const yearRaw = match[3];

	if (!Number.isFinite(month) || month < 1 || month > 12) {
		return { ok: false, error: 'Month must be between 1 and 12.' };
	}
	if (!Number.isFinite(day) || day < 1 || day > 31) {
		return { ok: false, error: 'Day must be between 1 and 31.' };
	}

	let year = now.getFullYear();
	if (yearRaw) {
		year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
	}

	const at = new Date(year, month - 1, day, 0, 0, 0, 0);
	if (at.getMonth() !== month - 1 || at.getDate() !== day) {
		return { ok: false, error: 'That date is not valid.' };
	}

	if (!yearRaw && at.getTime() <= now.getTime()) {
		at.setFullYear(at.getFullYear() + 1);
	}

	if (at.getTime() <= now.getTime()) {
		return { ok: false, error: 'That date is already in the past.' };
	}

	return { ok: true, at, kind: 'date' };
}

function parseDuration(input: string, now: Date): ParseDurationOrDateResult {
	const normalized = input
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/(\d)([a-zA-Z])/g, '$1 $2')
		.replace(/([a-zA-Z])(\d)/g, '$1 $2');

	let totalMs = 0;
	let matched = false;
	DURATION_TOKEN.lastIndex = 0;

	for (const match of normalized.matchAll(DURATION_TOKEN)) {
		matched = true;
		const amount = Number(match[1]);
		const unit = match[2].toLowerCase();
		if (!Number.isFinite(amount) || amount < 0) {
			return { ok: false, error: 'Duration values must be non-negative numbers.' };
		}

		if (unit.startsWith('h')) {
			totalMs += amount * 60 * 60 * 1000;
		} else if (unit.startsWith('m')) {
			totalMs += amount * 60 * 1000;
		} else if (unit.startsWith('s')) {
			totalMs += amount * 1000;
		}
	}

	if (!matched) {
		return {
			ok: false,
			error: 'Could not parse time. Try `24h`, `5m 28s`, or `08/12/2026`.'
		};
	}

	const remainder = normalized.replace(DURATION_TOKEN, '').replace(/\s+/g, '').trim();
	if (remainder.length > 0) {
		return {
			ok: false,
			error: 'Could not parse time. Try `24h`, `5m 28s`, or `08/12/2026`.'
		};
	}

	if (totalMs <= 0) {
		return { ok: false, error: 'Duration must be greater than zero.' };
	}

	return { ok: true, at: new Date(now.getTime() + totalMs), kind: 'duration' };
}

/**
 * Consumes a leading duration/date from a freeform staff args string.
 * Returns the parsed close time and the remaining reason text.
 */
export function splitLeadingTimeAndReason(argsText: string): {
	time: Extract<ParseDurationOrDateResult, { ok: true }> | null;
	reason?: string;
	error?: string;
} {
	const trimmed = argsText.trim();
	if (!trimmed) {
		return { time: null, reason: undefined };
	}

	const tokens = trimmed.split(/\s+/);

	// Calendar date is always a single token.
	if (/^\d{1,2}\/\d{1,2}(?:\/(?:\d{2}|\d{4}))?$/.test(tokens[0]!)) {
		const parsed = parseDurationOrDate(tokens[0]!);
		if (!parsed.ok) {
			return { time: null, reason: trimmed, error: parsed.error };
		}
		const reason = tokens.slice(1).join(' ').trim() || undefined;
		return { time: parsed, reason };
	}

	// Greedily take leading duration tokens until parse fails.
	let bestEnd = 0;
	let best: Extract<ParseDurationOrDateResult, { ok: true }> | null = null;

	for (let end = 1; end <= tokens.length; end++) {
		const candidate = tokens.slice(0, end).join(' ');
		const parsed = parseDurationOrDate(candidate);
		if (!parsed.ok) break;
		best = parsed;
		bestEnd = end;
	}

	if (!best) {
		return { time: null, reason: trimmed };
	}

	const reason = tokens.slice(bestEnd).join(' ').trim() || undefined;
	return { time: best, reason };
}
