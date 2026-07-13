import { ticketAppUrl } from '@/lib/discord/userDisplay';
import { pageLines, replyComponents, requireGuildPermission, textComponent } from '@/lib/discord/staffCommand';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Get previous ticket logs for a member.'
})
export class LogsCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'user',
					description: 'The member to look up.',
					type: ApplicationCommandOptionType.User,
					required: true
				}
			],
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!(await requireGuildPermission(interaction)))
			return replyComponents(
				interaction,
				textComponent('Logs', ['You do not have permission to view logs.']),
				{ fallback: 'You do not have permission to view logs.' }
			);
		const user = interaction.options.getUser('user', true);
		return this.replyLogs(interaction, user.id, user.tag);
	}

	public override async messageRun(message: Message) {
		if (!(await requireGuildPermission(message)))
			return replyComponents(
				message,
				textComponent('Logs', ['You do not have permission to view logs.']),
				{ fallback: 'You do not have permission to view logs.' }
			);
		const user = message.mentions.users.first();
		if (!user)
			return replyComponents(
				message,
				textComponent('Logs', ['Mention a member to look up.']),
				{ fallback: 'Mention a member to look up.' }
			);
		return this.replyLogs(message, user.id, user.tag);
	}

	private async replyLogs(target: Message | Command.ChatInputCommandInteraction, userId: string, label: string) {
		const { tickets } = TicketService.listTickets({ userId, limit: 50 });
		const { lines, totalPages } = pageLines(
			tickets,
			(ticket) => {
				const opened = ticket.createdAt.toLocaleDateString();
				const closed = ticket.closedAt ? `, closed ${ticket.closedAt.toLocaleDateString()}` : '';
				return `• [#${ticket.id}](${ticketAppUrl(ticket.id)}) — ${ticket.status}, opened ${opened}${closed}`;
			},
			0,
			10
		);
		return replyComponents(
			target,
			textComponent(`Ticket logs for ${label}`, lines, {
				kind: 'logs',
				page: 0,
				totalPages,
				context: userId
			})
		);
	}
}
