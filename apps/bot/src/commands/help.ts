import { pageLines, replyComponents, requireGuildPermission, textComponent } from '@/lib/discord/staffCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, Message } from 'discord.js';

const COMMANDS = [
	['contact', 'Create a ticket with one or more mentioned members.'],
	['add', 'Add a member to the current ticket.'],
	['remove', 'Remove a member from the current ticket.'],
	['participants', 'List members and staff on the current ticket.'],
	['logs', 'Show previous tickets for a member.'],
	['block', 'Block a user or role from tickets and bot commands.'],
	['blocked', 'Show blocked users and roles.'],
	['unblock', 'Remove a user or role block.'],
	['rename', 'Rename the ticket channel or forum post.'],
	['close', 'Close the ticket, optionally after a time (e.g. close 24h).'],
	['snippets', 'List custom message templates with staff commands.'],
	['autoclose', 'Toggle inactivity auto-close for this ticket (on/off).'],
	['about', 'Show bot information.'],
	['help', 'Show this command list.']
] as const;

@ApplyOptions<Command.Options>({
	description: 'Show available staff commands.'
})
export class HelpCommand extends Command {
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
				textComponent('Help', ['You do not have permission to use this command.']),
				{ fallback: 'You do not have permission to use this command.' }
			);
		return this.replyHelp(interaction);
	}

	public override async messageRun(message: Message) {
		if (!(await requireGuildPermission(message)))
			return replyComponents(
				message,
				textComponent('Help', ['You do not have permission to use this command.']),
				{ fallback: 'You do not have permission to use this command.' }
			);
		return this.replyHelp(message);
	}

	private async replyHelp(target: Message | Command.ChatInputCommandInteraction) {
		const { lines, totalPages } = pageLines(COMMANDS, ([name, description]) => `• **${name}** — ${description}`, 0, 12);
		return replyComponents(
			target,
			textComponent('Staff commands', lines, {
				kind: 'help',
				page: 0,
				totalPages
			})
		);
	}
}
