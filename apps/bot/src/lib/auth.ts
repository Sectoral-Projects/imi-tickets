import { betterAuth, type DiscordProfile, type OAuth2Tokens } from 'better-auth';
import { betterFetch } from '@better-fetch/fetch';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { container } from '@sapphire/pieces';
import * as schema from '@/database/sqlite/auth';

function discordPlaceholderEmail(profile: DiscordProfile) {
	return profile.email ?? profile.id;
}

function discordDisplayName(profile: DiscordProfile) {
	return profile.global_name || profile.username || '';
}

function discordAvatarUrl(profile: DiscordProfile) {
	if (profile.avatar === null) {
		const defaultAvatarNumber =
			profile.discriminator === '0'
				? Number(BigInt(profile.id) >> BigInt(22)) % 6
				: parseInt(profile.discriminator) % 5;
		return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
	}

	const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
}

/** Mutable local-user fields only. 1.7 rejects `id` from getUserInfo / mapProfileToUser. */
function discordUserFields(profile: DiscordProfile) {
	return {
		name: discordDisplayName(profile),
		email: discordPlaceholderEmail(profile),
		emailVerified: false as const,
		image: discordAvatarUrl(profile)
	};
}

function createAuth() {
	return betterAuth({
		database: drizzleAdapter(container.sqlite, {
			provider: 'sqlite',
			schema
		}),
		socialProviders: {
			discord: {
				clientId: process.env.DISCORD_CLIENT_ID as string,
				clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
				scope: ['identify', 'guilds'],
				disableDefaultScope: true,
				prompt: 'consent',
				getUserInfo: async (tokens: OAuth2Tokens) => {
					const { data: profile, error } = await betterFetch<DiscordProfile>(
						'https://discord.com/api/users/@me',
						{
							headers: {
								authorization: `Bearer ${tokens.accessToken}`
							}
						}
					);

					if (error) {
						return Promise.reject(error);
					}

					return {
						user: discordUserFields(profile),
						data: {
							...profile,
							email: discordPlaceholderEmail(profile)
						}
					};
				},
				overrideUserInfoOnSignIn: true,
				mapProfileToUser: (profile: DiscordProfile) => discordUserFields(profile)
			}
		},
		baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
		trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
		advanced: {
			ipAddress: {
				disableIpTracking: false
			}
		}
	});
}

type Auth = ReturnType<typeof createAuth>;

let auth: Auth | null = null;

export function initAuth() {
	auth ??= createAuth();
	return auth;
}

export function getAuth() {
	if (!auth) {
		throw new Error('Auth has not been initialized.');
	}

	return auth;
}
