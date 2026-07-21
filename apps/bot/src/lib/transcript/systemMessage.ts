/** Synthetic author id for transcript rows that are not from a Discord user message. */
export const TRANSCRIPT_SYSTEM_AUTHOR_ID = 'transcript:system';

/** Display label used in Discord relays and the staff transcript for system rows. */
export const TRANSCRIPT_SYSTEM_AUTHOR_LABEL = 'System';

export function resolveTranscriptUserLabel(user: {
	username: string | null;
	globalName?: string | null;
	tag?: string;
}) {
	return user.globalName?.trim() || user.username?.trim() || user.tag?.trim() || 'Unknown user';
}
