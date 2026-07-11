import { pageLines, replyComponents, requireGuildPermission, textComponent } from '@/lib/discord/staffCommand';
import { BlockService } from '@/services/block';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Show blocked users and roles.'
})
export class BlockedCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!(await requireGuildPermission(interaction)))
			return interaction.reply({ content: 'You do not have permission to view blocks.', ephemeral: true });
		return this.replyList(interaction);
	}

	public override async messageRun(message: Message) {
		if (!(await requireGuildPermission(message))) return message.reply('You do not have permission to view blocks.');
		return this.replyList(message);
	}

	private async replyList(target: Message | Command.ChatInputCommandInteraction) {
		const { entries } = BlockService.list({ limit: 50 });
		const { lines, totalPages } = pageLines(
			entries,
			(entry) => `**${entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1)}** <@${entry.entityId}>${entry.reason ? ` — ${entry.reason}` : ''}`,
			0,
			10
		);
		return replyComponents(
			target,
			textComponent('Blocked', lines, {
				kind: 'blocked',
				page: 0,
				totalPages
			})
		);
	}
}
