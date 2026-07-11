/** Leading single backtick — not `` or ``` (code fences). */
const PRIVATE_PREFIX = /^`(?!`)/;

/** Staff-only note in a ticket channel/post; must not relay to the member. */
export function isPrivateStaffMessage(content: string) {
	return PRIVATE_PREFIX.test(content);
}

export function stripPrivateStaffPrefix(content: string) {
	return content.replace(PRIVATE_PREFIX, '');
}
