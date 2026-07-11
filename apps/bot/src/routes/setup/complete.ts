import { requireSetupOwner } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { DiscordSetupService } from '@/services/discordSetup';
import { SetupService } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class SetupComplete extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.post(path, (c) => this.complete(c));
	}

	async complete(c: Context<ApiEnv, string, BlankInput>) {
		const denied = await requireSetupOwner(c);
		if (denied) return denied;

		const status = SetupService.getStatus(c.get('user')!.id);
		if (status.missingRequirements.length > 0) {
			return c.json({ error: 'Setup is incomplete', missingRequirements: status.missingRequirements }, 400);
		}

		for (const guild of status.linkedGuilds) {
			if (!(await DiscordSetupService.isBotPresent(guild.guildId))) {
				return c.json({ error: 'Bot is not present in every linked guild', code: 'BOT_NOT_PRESENT' }, 409);
			}
		}

		try {
			SetupService.complete(c.get('user')!.id);
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Setup is incomplete' }, 400);
		}

		return c.json(SetupService.getStatus(c.get('user')!.id));
	}
}
