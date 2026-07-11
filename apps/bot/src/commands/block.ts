import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	Message
} from 'discord.js';
import { requireGuildPermission, replyComponents, textComponent } from '@/lib/discord/staffCommand';
import { formatEntityMention } from '@/lib/discord/userDisplay';
import { BlockEntityType, BlockService } from '@/services/block';
import { RbacPermission } from '@/services/rbac';

function parseBlockReason(message: Message, rawReason: string | undefined) {
	const trimmed = rawReason?.trim();
	if (!trimmed) return undefined;

	let reason = trimmed;
	for (const user of message.mentions.users.values()) {
		reason = reason.replaceAll(`<@${user.id}>`, '').replaceAll(`<@!${user.id}>`, '');
	}
	for (const role of message.mentions.roles.values()) {
		reason = reason.replaceAll(`<@&${role.id}>`, '');
	}

	reason = reason.replace(/\s+/g, ' ').trim();
	return reason || undefined;
}

@ApplyOptions<Command.Options>({
	description: 'Block a user or role from opening tickets.'
})
export class BlockCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'target',
					description: 'The user or role to block.',
					type: ApplicationCommandOptionType.Mentionable,
					required: true
				},
				{
					name: 'reason',
					description: 'Why this user or role is blocked.',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			],
			integrationTypes,
			contexts
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!(await requireGuildPermission(interaction, RbacPermission.Manage))) {
			return replyComponents(interaction, textComponent('Block', ['You do not have permission to block users or roles.']));
		}

		const target = interaction.options.getUser('target') ?? interaction.options.getRole('target');
		if (!target) {
			return replyComponents(interaction, textComponent('Block', ['Choose a user or role to block.']));
		}

		const reason = interaction.options.getString('reason') ?? undefined;
		const entityType = 'bot' in target ? BlockEntityType.User : BlockEntityType.Role;

		BlockService.block({
			entityType,
			entityId: target.id,
			blockedBy: interaction.user.id,
			reason
		});

		const lines = [`Blocked ${formatEntityMention(target)}.`];
		if (reason) lines.push(`Reason: ${reason}`);

		return replyComponents(interaction, textComponent('Block', lines));
	}

	public override async messageRun(message: Message, args: Args) {
		if (!(await requireGuildPermission(message, RbacPermission.Manage))) {
			return replyComponents(message, textComponent('Block', ['You do not have permission to block users or roles.']));
		}

		const user = message.mentions.users.first();
		const role = message.mentions.roles.first();
		if (!user && !role) {
			return replyComponents(message, textComponent('Block', ['Mention a user or role to block.']));
		}

		const reason = parseBlockReason(message, await args.rest('string').catch(() => undefined));
		const entityType = user ? BlockEntityType.User : BlockEntityType.Role;
		const entity = user ?? role!;
		const entityId = entity.id;

		BlockService.block({
			entityType,
			entityId,
			blockedBy: message.author.id,
			reason
		});

		const lines = [`Blocked ${formatEntityMention(entity)}.`];
		if (reason) lines.push(`Reason: ${reason}`);

		return replyComponents(message, textComponent('Block', lines));
	}
}
