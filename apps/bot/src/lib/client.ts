import { SapphireClient, LogLevel, BucketScope } from '@sapphire/framework';
import { container } from '@sapphire/pieces';
import { GatewayIntentBits, Partials, Options } from 'discord.js';
import { createSqliteDatabase } from '@/database/sqlite/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { loadRoutes } from '@/lib/api/load';
import { httpRateLimiter } from '@/lib/api/rate-limit';
import { registerWebSocketRoutes } from '@/lib/api/websocket';
import { shouldRejectChannelRenameRateLimit } from '@/lib/discord/channelRename';
import { getAuth, initAuth } from '@/lib/auth';
import type { ApiEnv } from '@/lib/api/context';
import { SettingsService } from '@/services/settings';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 4000;

export class CustomClient extends SapphireClient {
	public constructor() {
		super({
			defaultPrefix: ';',
			fetchPrefix: () => SettingsService.getCommandPrefix(),
			caseInsensitiveCommands: true,
			intents: [
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.DirectMessageReactions,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.DirectMessageTyping,
				GatewayIntentBits.GuildMessageTyping
			],
			partials: [Partials.GuildMember, Partials.User, Partials.Channel, Partials.Message, Partials.Reaction],
			logger: {
				level: LogLevel.Debug
			},
			defaultCooldown: {
				delay: 2_000,
				limit: 1,
				scope: BucketScope.User
			},
			loadMessageCommandListeners: true,
			rest: {
				rejectOnRateLimit: shouldRejectChannelRenameRateLimit
			},
			sweepers: {
				...Options.DefaultSweeperSettings,
				messages: {
					interval: 900,
					lifetime: 1800
				},
				users: {
					interval: 3600,
					filter: () => (user) => user.bot && user.id !== user.client.user?.id
				},
				threads: {
					interval: 3600,
					lifetime: 7200
				}
			}
		});
	}

	public override async login() {
		container.sqlite = this.createDatabaseConnection();
		initAuth();
		await this.createHono();
		return super.login(process.env.TOKEN);
	}

	public override async destroy() {
		container.logger.info('Bot is shutting down...');
		return super.destroy();
	}

	private createDatabaseConnection() {
		container.logger.info('Creating database connection...');
		return createSqliteDatabase();
	}

	private async createHono() {
		const app = new Hono<ApiEnv>();

		// API serves a separate SPA origin — allow cross-origin reads after CORS.
		// See https://hono.dev/docs/middleware/builtin/secure-headers
		app.use(
			'*',
			secureHeaders({
				crossOriginResourcePolicy: 'cross-origin',
				xFrameOptions: 'DENY'
			})
		);

		app.use(
			'/*',
			cors({
				origin: FRONTEND_URL,
				allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
				allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
				credentials: true
			})
		);

		app.use('*', async (c, next) => {
			const session = await getAuth().api.getSession({ headers: c.req.raw.headers });

			c.set('session', session?.session ?? null);
			c.set('user', session?.user ?? null);

			await next();
		});

		// After session so keys can prefer user id over shared NAT IPs.
		// See https://honohub.dev/docs/rate-limiter
		app.use('*', httpRateLimiter);

		await loadRoutes(app);
		registerWebSocketRoutes(app);

		const wss = new WebSocketServer({ noServer: true });

		serve({
			fetch: app.fetch,
			port: PORT,
			hostname: HOST,
			websocket: { server: wss }
		});
		container.logger.info(`Hono server started on ${HOST}:${PORT}`);
	}
}

declare module '@sapphire/framework' {
	interface Container {
		sqlite: ReturnType<typeof createSqliteDatabase>;
	}
}