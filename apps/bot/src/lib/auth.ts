import { betterAuth, DiscordProfile, OAuth2Tokens } from 'better-auth';
import { betterFetch } from '@better-fetch/fetch';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { container } from '@sapphire/pieces';
import * as schema from '@/database/sqlite/auth';

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
					const { data: profile, error } = await betterFetch<DiscordProfile>('https://discord.com/api/users/@me', {
						headers: {
							authorization: `Bearer ${tokens.accessToken}`
						}
					});

					if (error) {
						return Promise.reject(error);
					}

					if (profile.avatar === null) {
						const defaultAvatarNumber =
							profile.name === '0' ? Number(BigInt(profile.id) >> BigInt(22)) % 6 : parseInt(profile.discriminator) % 5;
						profile.avatar = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
					} else {
						const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
						profile.avatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
					}

					return {
						user: {
							id: profile.id,
							name: profile.global_name || profile.username || '',
							email: profile.id,
							emailVerified: false,
							image: profile.avatar
						},
						data: {
							...profile,
							email: profile.id
						}
					};
				},
				overrideUserInfoOnSignIn: true,
				mapProfileToUser: async (profile: DiscordProfile) => {
					if (profile.avatar === null) {
						const defaultAvatarNumber =
							profile.discriminator === '0' ? Number(BigInt(profile.id) >> BigInt(22)) % 6 : parseInt(profile.discriminator) % 5;
						profile.avatar = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
					} else {
						const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
						profile.avatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
					}

					return profile;
				}
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
