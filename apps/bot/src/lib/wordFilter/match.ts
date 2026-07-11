export type WordMatchMode = 'keyword' | 'exact';

export type WordFilterRule = {
	term: string;
	match: WordMatchMode;
};

export type FieldWordFilter = {
	mode: 'blacklist' | 'whitelist';
	match: WordMatchMode;
	terms: string[];
};

const MAX_RULES = 100;
const MAX_TERM_LENGTH = 100;

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeWordFilterRules(value: unknown): WordFilterRule[] {
	if (!Array.isArray(value)) return [];

	const rules: WordFilterRule[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;
		const term = String((entry as WordFilterRule).term ?? '').trim();
		const match = (entry as WordFilterRule).match === 'exact' ? 'exact' : 'keyword';
		if (!term) continue;
		if (term.length > MAX_TERM_LENGTH) {
			throw new Error(`Word filter terms must be ${MAX_TERM_LENGTH} characters or fewer`);
		}
		rules.push({ term, match });
		if (rules.length >= MAX_RULES) break;
	}
	return rules;
}

export function normalizeFieldWordFilter(value: unknown): FieldWordFilter | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const raw = value as Partial<FieldWordFilter>;
	const mode = raw.mode === 'whitelist' ? 'whitelist' : raw.mode === 'blacklist' ? 'blacklist' : null;
	if (!mode) return undefined;

	const match = raw.match === 'exact' ? 'exact' : 'keyword';
	const terms = Array.isArray(raw.terms)
		? raw.terms
				.map((term) => String(term ?? '').trim())
				.filter(Boolean)
				.map((term) => {
					if (term.length > MAX_TERM_LENGTH) {
						throw new Error(`Word filter terms must be ${MAX_TERM_LENGTH} characters or fewer`);
					}
					return term;
				})
				.slice(0, MAX_RULES)
		: [];

	if (terms.length === 0) return undefined;
	return { mode, match, terms };
}

function matchesRule(text: string, rule: WordFilterRule): boolean {
	const haystack = text.toLowerCase();
	const needle = rule.term.toLowerCase();
	if (!needle) return false;

	if (rule.match === 'keyword') {
		return haystack.includes(needle);
	}

	// Exact: whole-token / URL-host friendly — match as a standalone token or full string.
	if (haystack === needle) return true;
	const pattern = new RegExp(`(?:^|[^\\w./-])${escapeRegExp(needle)}(?:$|[^\\w./-])`, 'i');
	return pattern.test(text);
}

export function findBlacklistHit(text: string, rules: WordFilterRule[]): WordFilterRule | null {
	for (const rule of rules) {
		if (matchesRule(text, rule)) return rule;
	}
	return null;
}

/** Returns true when whitelist is active and none of the terms match. */
export function findWhitelistMiss(text: string, rules: WordFilterRule[]): boolean {
	if (rules.length === 0) return false;
	return !rules.some((rule) => matchesRule(text, rule));
}

export function evaluateFieldWordFilter(
	text: string,
	filter: FieldWordFilter | undefined
): { ok: true } | { ok: false; mode: 'blacklist' | 'whitelist'; hit?: WordFilterRule; terms: string[] } {
	if (!filter || filter.terms.length === 0) return { ok: true };

	const rules = filter.terms.map((term) => ({ term, match: filter.match }));

	if (filter.mode === 'blacklist') {
		const hit = findBlacklistHit(text, rules);
		if (hit) return { ok: false, mode: 'blacklist', hit, terms: filter.terms };
		return { ok: true };
	}

	if (findWhitelistMiss(text, rules)) {
		return { ok: false, mode: 'whitelist', terms: filter.terms };
	}
	return { ok: true };
}

export const PREFIX_MAX_LENGTH = 5;

export function normalizeBotPrefix(value: unknown, fieldName: string): string {
	if (typeof value !== 'string') {
		throw new Error(`${fieldName} must be a string`);
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${fieldName} cannot be empty`);
	}
	if (/\s/.test(trimmed)) {
		throw new Error(`${fieldName} cannot contain whitespace`);
	}
	if (trimmed.length > PREFIX_MAX_LENGTH) {
		throw new Error(`${fieldName} must be ${PREFIX_MAX_LENGTH} characters or fewer`);
	}
	return trimmed;
}
