import { SettingsService, type WhitelabelPresenceSettings } from '@/services/settings';
import { container } from '@sapphire/framework';
import {
	ActivityType,
	type APIGuildMember,
	type GuildMemberEditMeOptions
} from 'discord.js';
import type { DbClient } from './types';

export const WhitelabelActivityType = {
	Playing: 'playing',
	Listening: 'listening',
	Watching: 'watching',
	Competing: 'competing',
	Custom: 'custom'
} as const;

export type WhitelabelActivityType =
	(typeof WhitelabelActivityType)[keyof typeof WhitelabelActivityType];

export type { WhitelabelPresenceSettings };

export type WhitelabelGuildSummary = {
	id: string;
	name: string;
	iconUrl: string | null;
	isPrimary: boolean;
};

export type WhitelabelProfileView = {
	guildId: string;
	nick: string | null;
	bio: string | null;
	avatarUrl: string | null;
	username: string;
	globalAvatarUrl: string | null;
};

export type WhitelabelView = {
	primaryGuildId: string | null;
	guilds: WhitelabelGuildSummary[];
	profile: WhitelabelProfileView | null;
	presence: WhitelabelPresenceSettings;
};

export type UpdateWhitelabelInput = {
	guildId: string;
	nick?: string | null;
	bio?: string | null;
	/** Data URI or null to clear guild avatar. Omit to leave unchanged. */
	avatarDataUri?: string | null;
	clearAvatar?: boolean;
	statusText?: string;
	activityType?: WhitelabelActivityType;
};

const DEFAULT_PRESENCE: WhitelabelPresenceSettings = {
	statusText: 'for tickets',
	activityType: WhitelabelActivityType.Watching
};

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const MAX_NICK = 32;
const MAX_BIO = 190;
const MAX_STATUS_TEXT = 128;

type GuildMemberMePayload = APIGuildMember & {
	bio?: string | null;
};

export abstract class WhitelabelService {
	static listGuilds(db: DbClient = container.sqlite): WhitelabelGuildSummary[] {
		const primaryGuildId =
			SettingsService.get(db)?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID ?? null;

		return [...container.client.guilds.cache.values()]
			.map((guild) => ({
				id: guild.id,
				name: guild.name,
				iconUrl: guild.iconURL({ size: 64 }) ?? null,
				isPrimary: guild.id === primaryGuildId
			}))
			.sort((a, b) => {
				if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
	}

	static getStoredPresence(db: DbClient = container.sqlite): WhitelabelPresenceSettings {
		const stored = SettingsService.getAppSettings(db).whitelabelPresence;
		if (!stored) return { ...DEFAULT_PRESENCE };
		return normalizePresence(stored);
	}

	static hasStoredPresence(db: DbClient = container.sqlite) {
		return Boolean(SettingsService.getAppSettings(db).whitelabelPresence);
	}

	static async getView(guildId?: string | null, db: DbClient = container.sqlite): Promise<WhitelabelView> {
		const guilds = this.listGuilds(db);
		const primaryGuildId =
			SettingsService.get(db)?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID ?? null;
		const selectedId =
			(guildId && guilds.some((guild) => guild.id === guildId) ? guildId : null) ??
			(primaryGuildId && guilds.some((guild) => guild.id === primaryGuildId)
				? primaryGuildId
				: null) ??
			guilds[0]?.id ??
			null;

		const profile = selectedId ? await this.getProfile(selectedId) : null;

		return {
			primaryGuildId,
			guilds,
			profile,
			presence: this.getStoredPresence(db)
		};
	}

	static async getProfile(guildId: string): Promise<WhitelabelProfileView> {
		const guild = await container.client.guilds.fetch(guildId).catch(() => null);
		if (!guild) {
			throw new Error('Guild not found or the bot is not in that server.');
		}

		const me = await guild.members.fetchMe();
		const raw = (await container.client.rest
			.get(`/guilds/${guildId}/members/@me`)
			.catch(() => null)) as GuildMemberMePayload | null;

		return {
			guildId,
			nick: raw?.nick ?? me.nickname,
			bio: raw?.bio ?? null,
			avatarUrl: me.avatarURL({ size: 256 }) ?? null,
			username: me.user.username,
			globalAvatarUrl: me.user.displayAvatarURL({ size: 256 })
		};
	}

	static async update(userId: string, input: UpdateWhitelabelInput, db: DbClient = container.sqlite) {
		const guildId = input.guildId?.trim();
		if (!guildId) {
			throw new Error('guildId is required');
		}

		const guild = await container.client.guilds.fetch(guildId).catch(() => null);
		if (!guild) {
			throw new Error('Guild not found or the bot is not in that server.');
		}

		const edit: GuildMemberEditMeOptions = {
			reason: `Whitelabel updated by ${userId}`
		};

		if ('nick' in input) {
			edit.nick = normalizeNick(input.nick);
		}
		if ('bio' in input) {
			edit.bio = normalizeBio(input.bio);
		}
		if (input.clearAvatar || input.avatarDataUri === null) {
			edit.avatar = null;
		} else if (typeof input.avatarDataUri === 'string' && input.avatarDataUri.trim()) {
			edit.avatar = parseAvatarDataUri(input.avatarDataUri.trim());
		}

		const shouldEditMember =
			'nick' in input || 'bio' in input || 'avatarDataUri' in input || input.clearAvatar;
		if (shouldEditMember) {
			await guild.members.editMe(edit);
		}

		if ('statusText' in input || 'activityType' in input) {
			const current = this.getStoredPresence(db);
			const next = normalizePresence({
				statusText: input.statusText ?? current.statusText,
				activityType: input.activityType ?? current.activityType
			});
			SettingsService.update(userId, { settings: { whitelabelPresence: next } }, db);
			this.applyPresence(next);
		}

		return this.getView(guildId, db);
	}

	/** Returns true when stored presence was applied (skips legacy ready status). */
	static applyStoredPresence(db: DbClient = container.sqlite) {
		if (!this.hasStoredPresence(db)) return false;
		this.applyPresence(this.getStoredPresence(db));
		return true;
	}

	static applyPresence(presence: WhitelabelPresenceSettings) {
		const user = container.client.user;
		if (!user) return;

		const text = presence.statusText.trim() || DEFAULT_PRESENCE.statusText;
		const type = toDiscordActivityType(presence.activityType);

		if (type === ActivityType.Custom) {
			user.setPresence({
				status: 'online',
				activities: [{ name: 'Custom Status', type, state: text }]
			});
			return;
		}

		user.setPresence({
			status: 'online',
			activities: [{ name: text, type }]
		});
	}
}

function normalizeNick(value: string | null | undefined) {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.length > MAX_NICK) {
		throw new Error(`Nickname must be at most ${MAX_NICK} characters`);
	}
	return trimmed;
}

function normalizeBio(value: string | null | undefined) {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.length > MAX_BIO) {
		throw new Error(`Description must be at most ${MAX_BIO} characters`);
	}
	return trimmed;
}

function normalizePresence(value: Partial<WhitelabelPresenceSettings> | undefined): WhitelabelPresenceSettings {
	const activityType = normalizeActivityType(value?.activityType);
	const statusText = (value?.statusText ?? DEFAULT_PRESENCE.statusText).trim().slice(0, MAX_STATUS_TEXT);
	return {
		statusText: statusText || DEFAULT_PRESENCE.statusText,
		activityType
	};
}

function normalizeActivityType(value: unknown): WhitelabelActivityType {
	if (typeof value === 'string' && Object.values(WhitelabelActivityType).includes(value as WhitelabelActivityType)) {
		return value as WhitelabelActivityType;
	}
	return DEFAULT_PRESENCE.activityType;
}

function toDiscordActivityType(value: WhitelabelActivityType): ActivityType {
	switch (value) {
		case WhitelabelActivityType.Playing:
			return ActivityType.Playing;
		case WhitelabelActivityType.Listening:
			return ActivityType.Listening;
		case WhitelabelActivityType.Competing:
			return ActivityType.Competing;
		case WhitelabelActivityType.Custom:
			return ActivityType.Custom;
		case WhitelabelActivityType.Watching:
		default:
			return ActivityType.Watching;
	}
}

function parseAvatarDataUri(dataUri: string) {
	const match = /^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUri);
	if (!match) {
		throw new Error('Avatar must be a PNG, JPEG, GIF, or WebP data URI');
	}

	const buffer = Buffer.from(match[2]!, 'base64');
	if (buffer.byteLength === 0) {
		throw new Error('Avatar image is empty');
	}
	if (buffer.byteLength > MAX_AVATAR_BYTES) {
		throw new Error('Avatar image is too large (max 8MB)');
	}

	return dataUri;
}
