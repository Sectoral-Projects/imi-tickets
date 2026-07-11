import { ChannelTicketPanelAck } from '@/lib/components/channelTicketPanelAck';
import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from 'discord.js';

const ACK_COPY = {
	opened: {
		title: 'Ticket opened',
		body: 'Check your DMs to continue the conversation with staff.'
	},
	existing_open: {
		title: 'Open ticket already active',
		body: 'You already have an open ticket. Check your DMs to continue.'
	}
} as const;

export async function replyChannelPanelTicketAck(
	interaction: ButtonInteraction | ModalSubmitInteraction,
	kind: keyof typeof ACK_COPY
) {
	const components = await ChannelTicketPanelAck.render(ACK_COPY[kind]);

	await interaction.reply({
		components,
		flags: interaction.inGuild()
			? [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
			: [MessageFlags.IsComponentsV2]
	});
}
