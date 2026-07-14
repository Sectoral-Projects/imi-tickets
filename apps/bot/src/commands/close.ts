import { Closed } from '@/lib/components/closed';
import { NotFound } from '@/lib/components/notFound';
import { ScheduledCloseNotice } from '@/lib/components/scheduledCloseNotice';
import { parseDurationOrDate, splitLeadingTimeAndReason } from '@/lib/discord/parseDurationOrDate';
import { requireGuildPermission, respondComponents, textComponent } from '@/lib/discord/staffCommand';
import { TicketCloseService } from '@/services/ticketClose';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	ChannelType,
	InteractionContextType,
	Message,
	MessageFlags
} from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Close the ticket.'
})
export class UserCloseCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'time',
					description: 'Schedule close after a duration or on a date (e.g. 24h, 08/12). Staff only.',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'reason',
					description: 'Why the ticket is being closed.',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			],
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.BotDM, InteractionContextType.Guild]
		});
	}

	public override async messageRun(message: Message, args: Args) {
		if (message.channel.type === ChannelType.DM) {
			return this.handleUserMessage(message);
		}

		if (!message.inGuild()) return;

		const rest = await args.rest('string').catch(() => null);
		const { time, reason, error } = splitLeadingTimeAndReason(rest?.trim() ?? '');
		if (error) {
			await respondComponents(message, textComponent('Close', [error]), { fallback: error });
			return;
		}

		return this.handleStaffMessage(message, reason, time?.at);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const reason = interaction.options.getString('reason') ?? undefined;
		const timeRaw = interaction.options.getString('time');

		if (interaction.inGuild()) {
			let scheduledAt: Date | undefined;
			if (timeRaw?.trim()) {
				const parsed = parseDurationOrDate(timeRaw);
				if (!parsed.ok) {
					await respondComponents(interaction, textComponent('Close', [parsed.error]), {
						fallback: parsed.error
					});
					return;
				}
				scheduledAt = parsed.at;
			}
			return this.handleStaffInteraction(interaction, reason, scheduledAt);
		}

		return this.handleUserInteraction(interaction);
	}

	public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
		if (interaction.inGuild()) {
			return this.handleStaffInteraction(interaction);
		}

		return this.handleUserInteraction(interaction);
	}

	private async handleUserMessage(message: Message) {
		const thread = TicketService.findOpenThreadForUser(message.author.id);
		if (!thread) {
			await respondComponents(message, await NotFound.render(), {
				fallback: 'No open ticket found.'
			});
			return;
		}

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: message.author.id,
			skipMemberDm: true
		});

		await respondComponents(message, await Closed.render(), { fallback: 'Ticket closed.' });
	}

	private async handleUserInteraction(
		interaction: Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction
	) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		const thread = TicketService.findOpenThreadForUser(interaction.user.id);
		if (!thread) {
			await respondComponents(interaction, await NotFound.render(), {
				fallback: 'No open ticket found.'
			});
			return;
		}

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: interaction.user.id,
			skipMemberDm: true
		});

		await respondComponents(interaction, await Closed.render(), { fallback: 'Ticket closed.' });
	}

	private async handleStaffMessage(message: Message, reason?: string, scheduledAt?: Date) {
		const thread = TicketService.findOpenByStaffChannelId(message.channel.id);
		if (!thread) {
			await respondComponents(message, await NotFound.render(), {
				fallback: 'No open ticket found for this channel.'
			});
			return;
		}

		if (!(await requireGuildPermission(message))) {
			await respondComponents(
				message,
				textComponent('Close', ['You do not have permission to close tickets.']),
				{ fallback: 'You do not have permission to close tickets.' }
			);
			return;
		}

		if (scheduledAt) {
			const notice = await ScheduledCloseNotice.renderNotice({
				closesAt: scheduledAt,
				reason
			});
			const unix = Math.floor(scheduledAt.getTime() / 1000);
			const fallback = `Ticket scheduled to close <t:${unix}:R> (<t:${unix}:f>).${
				reason ? ` Reason: ${reason}` : ''
			}`;
			const staffNotice = await respondComponents(message, notice, { fallback });
			if (!message.channel.isTextBased()) return;
			await TicketCloseService.scheduleClose({
				threadId: thread.id,
				closesAt: scheduledAt,
				reason,
				executedBy: message.author.id,
				staffChannel: message.channel,
				staffNoticeMessage: staffNotice
			});
			return;
		}

		const line = reason ? `Ticket closed. Reason: ${reason}` : 'Ticket closed.';
		await respondComponents(message, textComponent('Close', [line]), { fallback: line });

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: message.author.id,
			reason
		});
	}

	private async handleStaffInteraction(
		interaction: Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction,
		reason?: string,
		scheduledAt?: Date
	) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		if (!interaction.channel) {
			await respondComponents(
				interaction,
				textComponent('Close', ['This command can only be used in a ticket channel.']),
				{ fallback: 'This command can only be used in a ticket channel.' }
			);
			return;
		}

		const thread = TicketService.findOpenByStaffChannelId(interaction.channel.id);
		if (!thread) {
			await respondComponents(interaction, await NotFound.render(), {
				fallback: 'No open ticket found for this channel.'
			});
			return;
		}

		if (!(await requireGuildPermission(interaction))) {
			await respondComponents(
				interaction,
				textComponent('Close', ['You do not have permission to close tickets.']),
				{ fallback: 'You do not have permission to close tickets.' }
			);
			return;
		}

		if (scheduledAt) {
			if (!interaction.channel.isTextBased()) {
				await respondComponents(
					interaction,
					textComponent('Close', ['This command can only be used in a ticket channel.']),
					{ fallback: 'This command can only be used in a ticket channel.' }
				);
				return;
			}

			const unix = Math.floor(scheduledAt.getTime() / 1000);
			const fallback = `Ticket scheduled to close <t:${unix}:R> (<t:${unix}:f>).${
				reason ? ` Reason: ${reason}` : ''
			}`;
			await respondComponents(
				interaction,
				textComponent('Close', [fallback]),
				{ fallback }
			);
			await TicketCloseService.scheduleClose({
				threadId: thread.id,
				closesAt: scheduledAt,
				reason,
				executedBy: interaction.user.id,
				staffChannel: interaction.channel
			});
			return;
		}

		const line = reason ? `Ticket closed. Reason: ${reason}` : 'Ticket closed.';
		await respondComponents(interaction, textComponent('Close', [line]), { fallback: line });

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: interaction.user.id,
			reason
		});
	}
}
