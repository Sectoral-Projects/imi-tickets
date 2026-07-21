import { container } from '@sapphire/framework';
import {
	MessageFlags,
	time,
	type APIMessageTopLevelComponent,
	type MessageMentionOptions
} from 'discord.js';

export abstract class DiscordChannelService {
	static async sendComponents(
		channelId: string,
		components: APIMessageTopLevelComponent[],
		options: { allowedMentions?: MessageMentionOptions } = {}
	) {
		const channel = await container.client.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased() || !channel.isSendable()) return null;

		return channel.send({
			components,
			flags: MessageFlags.IsComponentsV2,
			...(options.allowedMentions ? { allowedMentions: options.allowedMentions } : {})
		});
	}

	static async editComponents(
		channelId: string,
		messageId: string,
		components: APIMessageTopLevelComponent[]
	) {
		const channel = await container.client.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased()) return null;

		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) return null;

		return message.edit({
			components,
			flags: MessageFlags.IsComponentsV2
		});
	}

	static async deleteMessage(channelId: string, messageId: string) {
		const channel = await container.client.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased()) return false;

		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) return false;

		await message.delete().catch(() => null);
		return true;
	}

	static formatTimestamp(date = new Date()) {
		return time(date, 'f');
	}
}
