import { NotFound } from '@/lib/components/notFound';
import { requireGuildPermission, respondComponents, textComponent } from '@/lib/discord/staffCommand';
import { AutoCloseService } from '@/services/autoClose';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	Message,
	MessageFlags
} from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Enable or disable inactivity auto-close for this ticket.'
})
export class AutocloseCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'state',
					description: 'Turn inactivity auto-close on or off for this ticket.',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: 'on', value: 'on' },
						{ name: 'off', value: 'off' }
					]
				}
			],
			integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild]
		});
	}

	public override async messageRun(message: Message, args: Args) {
		if (!message.inGuild()) return;

		const stateArg = await args.pick('string').catch(() => null);
		return this.handle(message, message.channel.id, stateArg);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		if (!interaction.channel) {
			await respondComponents(
				interaction,
				textComponent('Auto-close', ['This command can only be used in a ticket channel.']),
				{ fallback: 'This command can only be used in a ticket channel.' }
			);
			return;
		}

		const state = interaction.options.getString('state');
		return this.handle(interaction, interaction.channel.id, state);
	}

	private async handle(
		target: Message | Command.ChatInputCommandInteraction,
		channelId: string,
		stateRaw: string | null
	) {
		const thread = TicketService.findOpenByStaffChannelId(channelId);
		if (!thread) {
			await respondComponents(target, await NotFound.render(), {
				fallback: 'No open ticket found for this channel.'
			});
			return;
		}

		if (!(await requireGuildPermission(target))) {
			await respondComponents(
				target,
				textComponent('Auto-close', ['You do not have permission to manage auto-close for this ticket.']),
				{ fallback: 'You do not have permission to manage auto-close for this ticket.' }
			);
			return;
		}

		const state = stateRaw?.trim().toLowerCase();
		if (state === 'on' || state === 'off') {
			TicketService.setAutoCloseDisabled(thread.id, state === 'off');
			AutoCloseService.wake();
			const line =
				state === 'off'
					? 'Inactivity auto-close is now **off** for this ticket.'
					: 'Inactivity auto-close is now **on** for this ticket.';
			await respondComponents(target, textComponent('Auto-close', [line]), { fallback: line });
			return;
		}

		if (state && state !== 'on' && state !== 'off') {
			await respondComponents(
				target,
				textComponent('Auto-close', ['Usage: `autoclose`, `autoclose on`, or `autoclose off`.']),
				{ fallback: 'Usage: autoclose, autoclose on, or autoclose off.' }
			);
			return;
		}

		const line = thread.autoCloseDisabled
			? 'Inactivity auto-close is **off** for this ticket.'
			: 'Inactivity auto-close is **on** for this ticket.';
		await respondComponents(target, textComponent('Auto-close', [line]), { fallback: line });
	}
}
