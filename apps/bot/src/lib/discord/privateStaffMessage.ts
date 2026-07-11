import { SettingsService } from '@/services/settings';

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function privatePrefixPattern() {
	const prefix = SettingsService.getPrivateMessagePrefix();
	return new RegExp(`^${escapeRegExp(prefix)}`);
}

/** Staff-only note in a ticket channel/post; must not relay to the member. Also persisted via NoteService. */
export function isPrivateStaffMessage(content: string) {
	return privatePrefixPattern().test(content);
}

export function stripPrivateStaffPrefix(content: string) {
	return content.replace(privatePrefixPattern(), '');
}
