import { NotFound } from '@/lib/components/notFound';
import {
	formatCommandError,
	requireGuildPermission,
	respondComponents,
	textComponent
} from '@/lib/discord/staffCommand';
import { isChannelRenameRateLimited } from '@/lib/discord/channelRename';
import { RbacPermission } from '@/services/rbac';
import { TicketChannelService } from '@/services/ticketChannel';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, BucketScope, Command, container } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	Message,
	MessageFlags,
	type GuildBasedChannel
} from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Rename the ticket channel or forum post.',
	cooldownDelay: 0,
	cooldownLimit: 0,
	cooldownScope: BucketScope.User
})
export class RenameCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'name',
					description: 'The new channel or forum post name.',
					type: ApplicationCommandOptionType.String,
					required: true,
					max_length: 100
				}
			],
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		try {
			if (!interaction.deferred && !interaction.replied) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			}

			const name = interaction.options.getString('name', true);
			const channel = interaction.inGuild() ? interaction.channel : null;
			await this.renameInChannel(interaction, interaction.channelId, name, channel);
		} catch (error) {
			await this.respondFailure(
				interaction,
				error,
				'Failed to rename ticket channel.'
			);
		}
	}

	public override async messageRun(message: Message, args: Args) {
		try {
			if (!message.inGuild()) return;

			const name = await args.rest('string').catch(() => null);
			const trimmed = name?.trim();
			if (!trimmed) {
				await respondComponents(
					message,
					textComponent('Rename', ['Provide a new name, for example: `rename billing-question`.']),
					{ fallback: 'Provide a new name, for example: `rename billing-question`.' }
				);
				return;
			}

			await this.renameInChannel(message, message.channel.id, trimmed, message.channel);
		} catch (error) {
			await this.respondFailure(message, error, 'Failed to rename ticket channel.');
		}
	}

	private async renameInChannel(
		target: Message | Command.ChatInputCommandInteraction,
		channelId: string | null,
		name: string,
		channel: GuildBasedChannel | null
	) {
		if (!channelId) {
			await respondComponents(
				target,
				textComponent('Rename', ['This command can only be used in a ticket channel.']),
				{ fallback: 'This command can only be used in a ticket channel.' }
			);
			return;
		}

		if (!(await requireGuildPermission(target, RbacPermission.Manage))) {
			await respondComponents(
				target,
				textComponent('Rename', ['You do not have permission to rename tickets.']),
				{ fallback: 'You do not have permission to rename tickets.' }
			);
			return;
		}

		const thread = TicketService.findOpenByStaffChannelId(channelId);
		if (!thread) {
			await respondComponents(target, await NotFound.render(), {
				fallback: 'No ticket found for this channel.'
			});
			return;
		}

		const result = await TicketChannelService.renameStaffChannel(
			channelId,
			name,
			'author' in target ? target.author.id : target.user.id,
			undefined,
			channel
		);

		await respondComponents(target, textComponent('Ticket renamed', [`Renamed to **${result.name}**.`]), {
			fallback: `Ticket renamed to ${result.name}.`
		});
	}

	private async respondFailure(
		target: Message | Command.ChatInputCommandInteraction,
		error: unknown,
		fallback: string
	) {
		container.logger.error('Rename command failed', error);

		const reason = formatCommandError(error, fallback);
		const title = isChannelRenameRateLimited(error) ? 'Rename rate limited' : 'Rename failed';
		await respondComponents(target, textComponent(title, [reason]), {
			fallback: `${title}: ${reason}`
		});
	}
}
