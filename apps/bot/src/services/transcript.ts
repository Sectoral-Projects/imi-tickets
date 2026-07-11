import { formatUserIdentityLine, ticketAppUrl } from '@/lib/discord/userDisplay';
import { Transcript } from '@/lib/components/transcript';
import { container } from '@sapphire/framework';
import { DiscordChannelService } from './discordChannel';
import { SettingsService } from './settings';
import type { User } from 'discord.js';

export abstract class TranscriptService {
	static async sendTicketOpened(thread: { id: number; userId: string }, user: User) {
		const transcriptChannelId = SettingsService.get()?.transcriptChannelId;
		if (!transcriptChannelId) return;

		const nickname = await this.resolveNickname(user.id);
		const components = await Transcript.render({
			userLine: formatUserIdentityLine(user, nickname),
			ticketId: String(thread.id),
			ticketUrl: ticketAppUrl(thread.id)
		});

		await DiscordChannelService.sendComponents(transcriptChannelId, components);
	}

	private static async resolveNickname(userId: string) {
		const primaryGuildId = SettingsService.get()?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID;
		if (!primaryGuildId) return null;

		const guild = await container.client.guilds.fetch(primaryGuildId).catch(() => null);
		const member = await guild?.members.fetch(userId).catch(() => null);
		return member?.nickname ?? null;
	}
}
