import {
	formatCommandError,
	requireGuildPermission,
	respondComponents,
	textComponent
} from '@/lib/discord/staffCommand';
import { formatEntityMention } from '@/lib/discord/userDisplay';
import { TicketParticipantService } from '@/services/ticketParticipant';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	Message,
	MessageFlags,
	User
} from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Add a member to the current ticket.'
})
export class AddCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'user',
					description: 'The member to add.',
					type: ApplicationCommandOptionType.User,
					required: true
				}
			],
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		try {
			if (!(await requireGuildPermission(interaction))) {
				await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
				return;
			}

			if (!interaction.deferred && !interaction.replied) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			}

			const user = interaction.options.getUser('user', true);
			await this.addInChannel(interaction, interaction.channelId, user, interaction.user.id);
		} catch (error) {
			await respondComponents(
				interaction,
				textComponent('Add failed', [formatCommandError(error, 'Failed to add that member.')]),
				{ fallback: formatCommandError(error, 'Failed to add that member.') }
			);
		}
	}

	public override async messageRun(message: Message) {
		try {
			if (!message.inGuild()) return;
			if (!(await requireGuildPermission(message))) {
				await message.reply('You do not have permission to use this command.');
				return;
			}

			const user = message.mentions.users.first();
			if (!user) {
				await respondComponents(
					message,
					textComponent('Add', ['Mention a member to add, for example: `add @user`.']),
					{ fallback: 'Mention a member to add, for example: add @user.' }
				);
				return;
			}

			await this.addInChannel(message, message.channel.id, user, message.author.id);
		} catch (error) {
			await respondComponents(
				message,
				textComponent('Add failed', [formatCommandError(error, 'Failed to add that member.')]),
				{ fallback: formatCommandError(error, 'Failed to add that member.') }
			);
		}
	}

	private async addInChannel(
		target: Message | Command.ChatInputCommandInteraction,
		channelId: string,
		user: User,
		executedBy: string
	) {
		const thread = TicketService.findOpenByStaffChannelId(channelId);
		if (!thread) {
			await respondComponents(
				target,
				textComponent('Add', ['Run this command in an open ticket channel or forum post.']),
				{ fallback: 'Run this command in an open ticket channel or forum post.' }
			);
			return;
		}

		await TicketParticipantService.addUserToOpenTicket(thread.id, user, executedBy);
		await respondComponents(
			target,
			textComponent('Member added', [`Added ${formatEntityMention(user)} to ticket #${thread.id}.`]),
			{ fallback: `Added ${user.tag} to ticket #${thread.id}.` }
		);
	}
}
