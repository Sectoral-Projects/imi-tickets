import { requireSetupOwner } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { ChannelStrategy, SetupService, type ChannelStrategyType } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

interface ChannelStrategyBody {
	strategy?: ChannelStrategyType;
	channelId?: string;
}

export default class SetupGuildChannelStrategy extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.patch(path, (c) => this.update(c));
	}

	async update(c: Context<ApiEnv, string, BlankInput>) {
		const denied = await requireSetupOwner(c);
		if (denied) return denied;

		const guildId = c.req.param('guildId');
		const body = (await c.req.json()) as ChannelStrategyBody;

		if (!guildId) {
			return c.json({ error: 'guildId is required' }, 400);
		}

		if (!SetupService.isGuildLinked(guildId)) {
			return c.json({ error: 'Guild is not linked' }, 404);
		}

		if (!body.strategy || !body.channelId) {
			return c.json({ error: 'strategy and channelId are required' }, 400);
		}

		if (body.strategy !== ChannelStrategy.Category && body.strategy !== ChannelStrategy.Forum) {
			return c.json({ error: 'Invalid channel strategy' }, 400);
		}

		const resources = await DiscordSetupService.getGuildResources(guildId);
		const allowedChannels =
			body.strategy === ChannelStrategy.Category ? resources.categories : resources.forums;
		const channel = allowedChannels.find((item) => item.id === body.channelId);
		if (!channel) {
			return c.json({ error: 'Selected channel does not match the requested strategy' }, 400);
		}

		SetupService.setChannelStrategy(c.get('user')!.id, guildId, body.strategy, body.channelId);

		return c.json(SetupService.getStatus(c.get('user')!.id));
	}
}
