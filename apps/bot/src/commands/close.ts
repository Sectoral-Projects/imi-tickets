import { Closed } from '@/lib/components/closed';
import { NotFound } from '@/lib/components/notFound';
import { RbacPermission, RbacService } from '@/services/rbac';
import { TicketCloseService } from '@/services/ticketClose';
import { TicketParticipantService } from '@/services/ticketParticipant';
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

		const reason = await this.parseReason(args);
		return this.handleStaffMessage(message, reason);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const reason = interaction.options.getString('reason') ?? undefined;

		if (interaction.inGuild()) {
			return this.handleStaffInteraction(interaction, reason);
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
			await message.reply({ components: await NotFound.render(), flags: [MessageFlags.IsComponentsV2] });
			return;
		}

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: message.author.id,
			skipMemberDm: true
		});

		await message.reply({
			components: await Closed.render(),
			flags: [MessageFlags.IsComponentsV2]
		});
	}

	private async handleUserInteraction(
		interaction: Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction
	) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		const thread = TicketService.findOpenThreadForUser(interaction.user.id);
		if (!thread) {
			await interaction.editReply({ components: await NotFound.render(), flags: [MessageFlags.IsComponentsV2] });
			return;
		}

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: interaction.user.id,
			skipMemberDm: true
		});

		await interaction.editReply({ components: await Closed.render(), flags: [MessageFlags.IsComponentsV2] });
	}

	private async handleStaffMessage(message: Message, reason?: string) {
		const thread = TicketService.findOpenByStaffChannelId(message.channel.id);
		if (!thread) {
			await message.reply({ components: await NotFound.render(), flags: [MessageFlags.IsComponentsV2] });
			return;
		}

		if (!(await this.canCloseAsStaff(message.author.id, message.guildId))) {
			await message.reply({ content: 'You do not have permission to close tickets.' });
			return;
		}

		TicketParticipantService.noteStaffActivityInChannel(message.channel.id, message.author.id);

		await message.reply({
			content: reason ? `Ticket closed. Reason: ${reason}` : 'Ticket closed.'
		});

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: message.author.id,
			reason
		});
	}

	private async handleStaffInteraction(
		interaction: Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction,
		reason?: string
	) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		if (!interaction.channel) {
			await interaction.editReply({ content: 'This command can only be used in a ticket channel.' });
			return;
		}

		const thread = TicketService.findOpenByStaffChannelId(interaction.channel.id);
		if (!thread) {
			await interaction.editReply({ components: await NotFound.render(), flags: [MessageFlags.IsComponentsV2] });
			return;
		}

		if (!(await this.canCloseAsStaff(interaction.user.id, interaction.guildId))) {
			await interaction.editReply({ content: 'You do not have permission to close tickets.' });
			return;
		}

		TicketParticipantService.noteStaffActivityInChannel(interaction.channel.id, interaction.user.id);

		await interaction.editReply({
			content: reason ? `Ticket closed. Reason: ${reason}` : 'Ticket closed.'
		});

		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: interaction.user.id,
			reason
		});
	}

	private canCloseAsStaff(userId: string, guildId: string | null) {
		if (!guildId) return false;
		return RbacService.hasGuildPermission(userId, guildId, RbacPermission.Manage);
	}

	private async parseReason(args: Args) {
		const reason = await args.rest('string').catch(() => null);
		const trimmed = reason?.trim();
		return trimmed || undefined;
	}
}
