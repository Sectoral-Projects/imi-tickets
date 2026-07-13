import { pageLines, replyComponents, requireGuildPermission, textComponent } from '@/lib/discord/staffCommand';
import { MessageTemplateService } from '@/services/messageTemplate';
import { SettingsService } from '@/services/settings';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'List custom message templates with staff commands.'
})
export class SnippetsCommand extends Command {
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
			return replyComponents(
				interaction,
				textComponent('Snippets', ['You do not have permission to view snippets.']),
				{ fallback: 'You do not have permission to view snippets.' }
			);
		return this.replyList(interaction);
	}

	public override async messageRun(message: Message) {
		if (!(await requireGuildPermission(message)))
			return replyComponents(
				message,
				textComponent('Snippets', ['You do not have permission to view snippets.']),
				{ fallback: 'You do not have permission to view snippets.' }
			);
		return this.replyList(message);
	}

	private async replyList(target: Message | Command.ChatInputCommandInteraction) {
		const prefix = SettingsService.getCommandPrefix();
		const snippets = MessageTemplateService.list()
			.filter((template) => template.kind === 'custom' && template.enabled && template.staffCommand)
			.sort((a, b) => (a.staffCommand ?? '').localeCompare(b.staffCommand ?? ''));

		const { lines, totalPages } = pageLines(
			snippets,
			(template) => `**${prefix}${template.staffCommand}** — ${template.name}`,
			0,
			10
		);

		return replyComponents(
			target,
			textComponent('Snippets', lines.length ? lines : ['No enabled custom snippets with a staff command.'], {
				kind: 'snippets',
				page: 0,
				totalPages: Math.max(1, totalPages)
			})
		);
	}
}
