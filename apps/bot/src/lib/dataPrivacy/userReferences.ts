import { randomBytes } from 'node:crypto';

export type UserReferenceProfile = {
	userId: string;
	usernames: string[];
	displayNames: string[];
	avatarUrls: string[];
};

const SNOWFLAKE_MIN = BigInt('100000000000000000');
const SNOWFLAKE_RANGE = BigInt('900000000000000000');

export function generateAnonymousUserId() {
	const bytes = randomBytes(8);
	const value = (BigInt(`0x${bytes.toString('hex')}`) % SNOWFLAKE_RANGE) + SNOWFLAKE_MIN;
	return value.toString();
}

export function buildUserReferenceProfile(
	userId: string,
	snapshots: Array<{
		username?: string | null;
		globalName?: string | null;
		nickname?: string | null;
		avatar?: string | null;
	}>
): UserReferenceProfile {
	const usernames = new Set<string>();
	const displayNames = new Set<string>();
	const avatarUrls = new Set<string>();

	for (const snapshot of snapshots) {
		if (snapshot.username?.trim()) usernames.add(snapshot.username.trim());
		if (snapshot.globalName?.trim()) displayNames.add(snapshot.globalName.trim());
		if (snapshot.nickname?.trim()) displayNames.add(snapshot.nickname.trim());
		if (snapshot.avatar?.trim()) {
			avatarUrls.add(`https://cdn.discordapp.com/avatars/${userId}/${snapshot.avatar.trim()}.png`);
			avatarUrls.add(`https://cdn.discordapp.com/avatars/${userId}/${snapshot.avatar.trim()}.webp`);
			avatarUrls.add(`https://cdn.discordapp.com/avatars/${userId}/${snapshot.avatar.trim()}.gif`);
		}
	}

	return {
		userId,
		usernames: [...usernames],
		displayNames: [...displayNames],
		avatarUrls: [...avatarUrls]
	};
}

export function scrubTextForUserReferences(content: string, profile: UserReferenceProfile) {
	let next = content;

	next = next.replaceAll(`<@${profile.userId}>`, '[redacted user]');
	next = next.replaceAll(`<@!${profile.userId}>`, '[redacted user]');
	next = next.replaceAll(profile.userId, '[redacted user]');

	for (const username of profile.usernames) {
		next = replaceCaseInsensitive(next, `@${username}`, '[redacted user]');
		next = replaceCaseInsensitive(next, username, '[redacted user]');
	}

	for (const displayName of profile.displayNames) {
		next = replaceCaseInsensitive(next, displayName, '[redacted user]');
	}

	for (const avatarUrl of profile.avatarUrls) {
		next = next.replaceAll(avatarUrl, '[redacted media]');
	}

	return next;
}

export function scrubUnknownValue(value: unknown, profile: UserReferenceProfile): unknown {
	if (typeof value === 'string') {
		if (value === profile.userId) return '[redacted user]';
		return scrubTextForUserReferences(value, profile);
	}

	if (Array.isArray(value)) {
		return value.map((entry) => scrubUnknownValue(entry, profile));
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
				if (key === 'userId' || key === 'authorId' || key === 'executedBy' || key === 'entityId') {
					if (entry === profile.userId) return [key, '[redacted user]'];
				}
				return [key, scrubUnknownValue(entry, profile)];
			})
		);
	}

	return value;
}

function replaceCaseInsensitive(content: string, needle: string, replacement: string) {
	if (!needle) return content;
	const pattern = new RegExp(escapeRegExp(needle), 'gi');
	return content.replace(pattern, replacement);
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isDiscordUserId(value: string) {
	return /^\d{17,20}$/.test(value);
}
