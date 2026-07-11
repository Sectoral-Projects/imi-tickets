import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, ComponentType, InteractionContextType, Message, MessageFlags } from 'discord.js';
import { Pong } from '@/lib/components/pong';

@ApplyOptions<Command.Options>({
	description: 'ping pong'
})
export class UserCommand extends Command {
	private readonly pingComponent = {
		type: ComponentType.Container,
		components: [
			{
				type: ComponentType.TextDisplay,
				content: '# Ping?'
			}
		]
	};

	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall];
		const contexts: InteractionContextType[] = [
			InteractionContextType.BotDM,
			InteractionContextType.Guild,
			InteractionContextType.PrivateChannel
		];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			integrationTypes,
			contexts
		});
	}

	// Message command
	public override async messageRun(message: Message) {
		return this.sendPing(message);
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		return this.sendPing(interaction);
	}

	// Context Menu command
	public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
		return this.sendPing(interaction);
	}

	private async sendPing(interactionOrMessage: Message | Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction) {
		const pingMessage =
			interactionOrMessage instanceof Message
				? interactionOrMessage.channel?.isSendable() &&
					(await interactionOrMessage.channel.send({
						components: [this.pingComponent],
						flags: [MessageFlags.IsComponentsV2]
					}))
				: await interactionOrMessage.reply({
						components: [this.pingComponent],
						flags: [MessageFlags.IsComponentsV2]
					});

		if (!pingMessage) return;

		const latency = Math.round(this.container.client.ws.ping);

		const components = await Pong.render({ latency });

		if (pingMessage instanceof Message) {
			return pingMessage.edit({
				components
			});
		}

		return pingMessage.edit({
			components
		});
	}
}
