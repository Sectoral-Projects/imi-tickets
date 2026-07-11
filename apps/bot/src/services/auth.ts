import { account } from '@/database/sqlite/auth';
import { container } from '@sapphire/framework';
import { and, eq } from 'drizzle-orm';
import type { DbClient } from './types';

interface DiscordAccountRecord {
	id: string;
	accountId: string;
	accessToken: string | null;
	refreshToken: string | null;
	scope: string | null;
	accessTokenExpiresAt: Date | null;
}

interface DiscordTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	scope?: string;
	token_type: string;
}

export abstract class AuthService {
	static findDiscordAccount(userId: string, db: DbClient = container.sqlite) {
		return db
			.select({
				id: account.id,
				accountId: account.accountId,
				accessToken: account.accessToken,
				refreshToken: account.refreshToken,
				scope: account.scope,
				accessTokenExpiresAt: account.accessTokenExpiresAt
			})
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
			.limit(1)
			.get();
	}

	static findDiscordUserId(userId: string, db: DbClient = container.sqlite) {
		const discordAccount = this.findDiscordAccount(userId, db);

		return discordAccount?.accountId ?? null;
	}

	static hasDiscordScope(userId: string, scope: string, db: DbClient = container.sqlite) {
		const discordAccount = this.findDiscordAccount(userId, db);
		const scopes = discordAccount?.scope?.split(/[\s,]+/) ?? [];

		return scopes.includes(scope);
	}

	static async getDiscordAccessToken(userId: string, db: DbClient = container.sqlite) {
		const discordAccount = this.findDiscordAccount(userId, db);

		if (!discordAccount?.accessToken) {
			return null;
		}

		if (!this.isAccessTokenExpired(discordAccount)) {
			return discordAccount.accessToken;
		}

		if (!discordAccount.refreshToken) {
			return discordAccount.accessToken;
		}

		const refreshed = await this.refreshDiscordTokens(discordAccount.refreshToken);

		if (!refreshed) {
			return discordAccount.accessToken;
		}

		this.persistDiscordTokens(discordAccount, refreshed, db);

		return refreshed.access_token;
	}

	private static isAccessTokenExpired(discordAccount: DiscordAccountRecord) {
		if (!discordAccount.accessTokenExpiresAt) return false;

		return discordAccount.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
	}

	private static async refreshDiscordTokens(refreshToken: string) {
		const body = new URLSearchParams({
			client_id: process.env.DISCORD_CLIENT_ID ?? '',
			client_secret: process.env.DISCORD_CLIENT_SECRET ?? '',
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		});

		const response = await fetch('https://discord.com/api/v10/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body
		});

		if (!response.ok) {
			return null;
		}

		return (await response.json()) as DiscordTokenResponse;
	}

	private static persistDiscordTokens(
		discordAccount: DiscordAccountRecord,
		refreshed: DiscordTokenResponse,
		db: DbClient
	) {
		db.update(account)
			.set({
				accessToken: refreshed.access_token,
				refreshToken: refreshed.refresh_token ?? discordAccount.refreshToken,
				scope: refreshed.scope ?? discordAccount.scope,
				accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
				updatedAt: new Date()
			})
			.where(eq(account.id, discordAccount.id))
			.run();
	}
}
