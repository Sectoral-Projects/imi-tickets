import { requireGuildPermission, replyComponents, textComponent } from '@/lib/discord/staffCommand';
import { formatEntityMention } from '@/lib/discord/userDisplay';
import { BlockEntityType, BlockService } from '@/services/block';
import { RbacPermission } from '@/services/rbac';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Unblock a user or role.'
})
export class UnblockCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'target',
					description: 'The user or role to unblock.',
					type: ApplicationCommandOptionType.Mentionable,
					required: true
				}
			],
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!(await requireGuildPermission(interaction, RbacPermission.Admin))) {
			return replyComponents(interaction, textComponent('Unblock', ['You do not have permission to unblock users or roles.']));
		}

		const target = interaction.options.getUser('target') ?? interaction.options.getRole('target');
		if (!target) {
			return replyComponents(interaction, textComponent('Unblock', ['Choose a user or role to unblock.']));
		}

		const entityType = 'bot' in target ? BlockEntityType.User : BlockEntityType.Role;
		const deleted = BlockService.unblock(entityType, target.id, interaction.user.id);
		return replyComponents(
			interaction,
			textComponent(
				'Unblock',
				deleted ? [`Unblocked ${formatEntityMention(target)}.`] : ['That target is not blocked.']
			)
		);
	}

	public override async messageRun(message: Message, _args: Args) {
		if (!(await requireGuildPermission(message, RbacPermission.Admin))) {
			return replyComponents(message, textComponent('Unblock', ['You do not have permission to unblock users or roles.']));
		}

		const user = message.mentions.users.first();
		const role = message.mentions.roles.first();
		if (!user && !role) {
			return replyComponents(message, textComponent('Unblock', ['Mention a user or role to unblock.']));
		}

		const entityType = user ? BlockEntityType.User : BlockEntityType.Role;
		const entity = user ?? role!;
		const deleted = BlockService.unblock(entityType, entity.id, message.author.id);
		return replyComponents(
			message,
			textComponent(
				'Unblock',
				deleted ? [`Unblocked ${formatEntityMention(entity)}.`] : ['That target is not blocked.']
			)
		);
	}
}
