import { AuthService } from '@/services/auth';
import { container } from '@sapphire/framework';
import { CategoryChannel, ChannelType, ForumChannel, PermissionFlagsBits } from 'discord.js';

const DiscordApiBase = 'https://discord.com/api/v10';

export interface DiscordSetupGuild {
	id: string;
	name: string;
	icon: string | null;
	owner: boolean;
	permissions: string;
	isAdministrator: boolean;
	botPresent: boolean;
	inviteUrl: string;
}

export interface DiscordSetupChannelRef {
	id: string;
	name: string;
	type?: 'text' | 'forum';
}

export interface DiscordSetupResources {
	roles: Array<{
		id: string;
		name: string;
		position: number;
	}>;
	categories: DiscordSetupChannelRef[];
	forums: DiscordSetupChannelRef[];
}

interface DiscordUserGuild {
	id: string;
	name: string;
	icon: string | null;
	owner: boolean;
	permissions: string;
}

interface CachedUserGuildList {
	guilds: DiscordUserGuild[];
	expiresAt: number;
}

interface CachedAdminGuildList {
	result: {
		needsReauth: boolean;
		guilds: DiscordSetupGuild[];
	};
	expiresAt: number;
}

const USER_GUILD_CACHE_TTL_MS = 120_000;
const ADMIN_GUILD_CACHE_TTL_MS = 60_000;
const userGuildListCache = new Map<string, CachedUserGuildList>();
const adminGuildListCache = new Map<string, CachedAdminGuildList>();

export abstract class DiscordSetupService {
	static async listAdminGuilds(userId: string, options: { refresh?: boolean } = {}) {
		if (!options.refresh) {
			const cached = adminGuildListCache.get(userId);
			if (cached && cached.expiresAt > Date.now()) {
				return cached.result;
			}
		}

		const accessToken = await AuthService.getDiscordAccessToken(userId);

		if (!accessToken) {
			const result = { needsReauth: true, guilds: [] };
			adminGuildListCache.set(userId, {
				result,
				expiresAt: Date.now() + ADMIN_GUILD_CACHE_TTL_MS
			});
			return result;
		}

		let guilds: DiscordUserGuild[] | null;

		try {
			guilds = await this.fetchCurrentUserGuilds(accessToken, userId, options.refresh);
		} catch (error) {
			const cached = adminGuildListCache.get(userId);
			if (cached) {
				return cached.result;
			}

			throw error;
		}

		if (guilds === null) {
			const result = { needsReauth: true, guilds: [] };
			adminGuildListCache.set(userId, {
				result,
				expiresAt: Date.now() + ADMIN_GUILD_CACHE_TTL_MS
			});
			return result;
		}

		const adminGuilds = await Promise.all(
			guilds
				.filter((guild) => this.hasAdministrator(guild))
				.map(async (guild): Promise<DiscordSetupGuild> => ({
					id: guild.id,
					name: guild.name,
					icon: guild.icon,
					owner: guild.owner,
					permissions: guild.permissions,
					isAdministrator: true,
					botPresent: options.refresh
						? await this.isBotPresent(guild.id)
						: this.isBotPresentInCache(guild.id),
					inviteUrl: this.buildInviteUrl(guild.id)
				}))
		);

		const result = { needsReauth: false, guilds: adminGuilds };
		adminGuildListCache.set(userId, {
			result,
			expiresAt: Date.now() + ADMIN_GUILD_CACHE_TTL_MS
		});

		return result;
	}

	static async getGuildResources(guildId: string): Promise<DiscordSetupResources> {
		const guild = await container.client.guilds.fetch(guildId);
		const [roles, channels] = await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);

		const categories: DiscordSetupChannelRef[] = [];
		const forums: DiscordSetupChannelRef[] = [];

		for (const channel of channels.values()) {
			if (channel instanceof CategoryChannel) {
				categories.push({ id: channel.id, name: channel.name });
				continue;
			}

			if (channel instanceof ForumChannel) {
				forums.push({ id: channel.id, name: channel.name });
			}
		}

		categories.sort((a, b) => a.name.localeCompare(b.name));
		forums.sort((a, b) => a.name.localeCompare(b.name));

		return {
			roles: roles
				.filter((role) => role.id !== guild.id && !role.managed)
				.map((role) => ({
					id: role.id,
					name: role.name,
					position: role.position
				}))
				.sort((a, b) => b.position - a.position),
			categories,
			forums
		};
	}

	static async getTextChannels(guildId: string): Promise<DiscordSetupChannelRef[]> {
		const guild = await container.client.guilds.fetch(guildId);
		const channels = await guild.channels.fetch();
		const textChannels: DiscordSetupChannelRef[] = [];

		for (const channel of channels.values()) {
			if (!channel) continue;
			if (
				channel.type === ChannelType.GuildText ||
				channel.type === ChannelType.GuildAnnouncement
			) {
				textChannels.push({ id: channel.id, name: channel.name, type: 'text' });
			}
		}

		return textChannels.sort((a, b) => a.name.localeCompare(b.name));
	}

	static async getPanelChannels(guildId: string): Promise<DiscordSetupChannelRef[]> {
		const guild = await container.client.guilds.fetch(guildId);
		const channels = await guild.channels.fetch();
		const panelChannels: DiscordSetupChannelRef[] = [];

		for (const channel of channels.values()) {
			if (!channel) continue;
			if (
				channel.type === ChannelType.GuildText ||
				channel.type === ChannelType.GuildAnnouncement
			) {
				panelChannels.push({ id: channel.id, name: channel.name, type: 'text' });
				continue;
			}

			if (channel instanceof ForumChannel) {
				panelChannels.push({ id: channel.id, name: channel.name, type: 'forum' });
			}
		}

		return panelChannels.sort((a, b) => a.name.localeCompare(b.name));
	}

	static async getForumThreads(forumChannelId: string): Promise<DiscordSetupChannelRef[]> {
		const channel = await container.client.channels.fetch(forumChannelId).catch(() => null);
		if (!(channel instanceof ForumChannel)) return [];

		const [active, archived] = await Promise.all([
			channel.threads.fetchActive(),
			channel.threads.fetchArchived({ limit: 25 }).catch(() => null)
		]);

		const threads = [
			...active.threads.values(),
			...(archived ? archived.threads.values() : [])
		];

		return threads
			.map((thread) => ({
				id: thread.id,
				name: thread.name,
				type: 'text' as const
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	static isBotPresentInCache(guildId: string) {
		return container.client.guilds.cache.has(guildId);
	}

	static async isBotPresent(guildId: string) {
		if (this.isBotPresentInCache(guildId)) return true;

		try {
			await container.client.guilds.fetch(guildId);
			return true;
		} catch {
			return false;
		}
	}

	static buildInviteUrl(guildId: string) {
		const params = new URLSearchParams({
			client_id: process.env.DISCORD_CLIENT_ID ?? '',
			permissions: PermissionFlagsBits.Administrator.toString(),
			scope: 'bot applications.commands',
			guild_id: guildId,
			disable_guild_select: 'true'
		});

		return `https://discord.com/oauth2/authorize?${params}`;
	}

	private static async fetchCurrentUserGuilds(
		accessToken: string,
		userId: string,
		refresh = false
	): Promise<DiscordUserGuild[] | null> {
		const cached = userGuildListCache.get(userId);
		if (!refresh && cached && cached.expiresAt > Date.now()) {
			return cached.guilds;
		}

		const response = await this.requestCurrentUserGuilds(accessToken);

		if (response.status === 401 || response.status === 403) {
			return null;
		}

		if (response.status === 429) {
			if (cached) {
				return cached.guilds;
			}

			const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? '1');
			await this.sleep(Math.min(retryAfterSeconds * 1_000, 5_000));

			const retryResponse = await this.requestCurrentUserGuilds(accessToken);
			if (retryResponse.status === 401 || retryResponse.status === 403) {
				return null;
			}

			if (retryResponse.status === 429) {
				throw new Error('Discord is rate limiting guild lookups. Try again in a moment.');
			}

			if (!retryResponse.ok) {
				throw new Error(`Discord guild lookup failed with ${retryResponse.status}`);
			}

			const guilds = (await retryResponse.json()) as DiscordUserGuild[];
			this.storeUserGuildList(userId, guilds);
			return guilds;
		}

		if (!response.ok) {
			throw new Error(`Discord guild lookup failed with ${response.status}`);
		}

		const guilds = (await response.json()) as DiscordUserGuild[];
		this.storeUserGuildList(userId, guilds);
		return guilds;
	}

	private static requestCurrentUserGuilds(accessToken: string) {
		return fetch(`${DiscordApiBase}/users/@me/guilds`, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
	}

	private static storeUserGuildList(userId: string, guilds: DiscordUserGuild[]) {
		userGuildListCache.set(userId, {
			guilds,
			expiresAt: Date.now() + USER_GUILD_CACHE_TTL_MS
		});
	}

	private static sleep(durationMs: number) {
		return new Promise<void>((resolve) => {
			setTimeout(resolve, durationMs);
		});
	}

	private static hasAdministrator(guild: DiscordUserGuild) {
		return guild.owner || (BigInt(guild.permissions) & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
	}
}
