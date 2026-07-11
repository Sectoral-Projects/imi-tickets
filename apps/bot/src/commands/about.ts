import { replyComponents, requireGuildPermission, textComponent } from '@/lib/discord/staffCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Show basic information about the bot.'
})
export class AboutCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!(await requireGuildPermission(interaction))) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
		return this.replyAbout(interaction);
	}

	public override async messageRun(message: Message) {
		if (!(await requireGuildPermission(message))) return message.reply('You do not have permission to use this command.');
		return this.replyAbout(message);
	}

	private async replyAbout(target: Message | Command.ChatInputCommandInteraction) {
		return replyComponents(
			target,
			textComponent('imi/tickets', [
				'A Discord modmail bot with a staff web UI.',
				'Created by Im345.',
				'-# Use `help` for available staff commands.'
			])
		);
	}
}
