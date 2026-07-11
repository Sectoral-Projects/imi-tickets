import {
	formatCommandError,
	requireGuildPermission,
	respondComponents,
	textComponent
} from '@/lib/discord/staffCommand';
import { formatEntityMention } from '@/lib/discord/userDisplay';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Command, container } from '@sapphire/framework';
import {
	ApplicationIntegrationType,
	InteractionContextType,
	Message,
	MessageFlags,
	User
} from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'List members and staff participating in the current ticket.'
})
export class ParticipantsCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
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

			await this.replyParticipants(interaction, interaction.channelId);
		} catch (error) {
			await respondComponents(
				interaction,
				textComponent('Participants failed', [formatCommandError(error, 'Failed to list participants.')]),
				{ fallback: formatCommandError(error, 'Failed to list participants.') }
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

			await this.replyParticipants(message, message.channel.id);
		} catch (error) {
			await respondComponents(
				message,
				textComponent('Participants failed', [formatCommandError(error, 'Failed to list participants.')]),
				{ fallback: formatCommandError(error, 'Failed to list participants.') }
			);
		}
	}

	private async replyParticipants(target: Message | Command.ChatInputCommandInteraction, channelId: string) {
		const thread = TicketService.findOpenByStaffChannelId(channelId);
		if (!thread || !thread.channelId) {
			await respondComponents(
				target,
				textComponent('Participants', ['Run this command in an open ticket channel or forum post.']),
				{ fallback: 'Run this command in an open ticket channel or forum post.' }
			);
			return;
		}

		const members = TicketService.listUserParticipants(thread.id);
		const staffIds = TicketService.listStaffParticipantIds(thread.id, thread.channelId);

		const memberLines =
			members.length === 0
				? ['• None']
				: await Promise.all(
						members.map(async (participant) => {
							const user = await this.resolveUser(participant.userId);
							const label = user ? formatEntityMention(user) : `<@${participant.userId}>`;
							const alias =
								thread.hideMemberIdentities && participant.memberAlias != null
									? ` (User #${participant.memberAlias})`
									: '';
							return `• ${label}${alias}`;
						})
					);

		const staffLines =
			staffIds.length === 0
				? ['• None yet']
				: await Promise.all(
						staffIds.map(async (userId) => {
							const user = await this.resolveUser(userId);
							return `• ${user ? formatEntityMention(user) : `<@${userId}>`}`;
						})
					);

		await respondComponents(
			target,
			textComponent(`Participants — ticket #${thread.id}`, [
				'**Members (bot DMs)**',
				...memberLines,
				'',
				'**Staff (channel / post)**',
				...staffLines
			]),
			{
				fallback: [
					`Participants — ticket #${thread.id}`,
					'Members (bot DMs)',
					...memberLines.map((line) => line.replace(/[<>]/g, '')),
					'Staff (channel / post)',
					...staffLines.map((line) => line.replace(/[<>]/g, ''))
				].join('\n')
			}
		);
	}

	private async resolveUser(userId: string): Promise<User | null> {
		return container.client.users.fetch(userId).catch(() => null);
	}
}
