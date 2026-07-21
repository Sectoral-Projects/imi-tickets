import { Created } from '@/lib/components/created';
import { renderSubjectTemplate } from '@/lib/buttonActions/subjectTemplate';
import { OutboundDmGuard } from '@/lib/discord/outboundDmGuard';
import { replyChannelPanelTicketAck } from '@/lib/discord/channelPanelAck';
import { DiscordChannelService } from '@/services/discordChannel';
import { SettingsService } from '@/services/settings';
import { TemplateButtonService } from '@/services/templateButton';
import { TicketOpenService } from '@/services/ticketOpen';
import type { ChannelOpenButton } from '@/services/channelOpenButton';
import type { ButtonInteraction, ModalSubmitInteraction, User } from 'discord.js';

export async function completeChannelPanelTicketOpen(
	interaction: ButtonInteraction | ModalSubmitInteraction,
	user: User,
	button: ChannelOpenButton,
	modalVars: Record<string, unknown>
) {
	const dm = await user.createDM().catch(() => null);
	if (!dm) {
		await interaction.reply({
			content: "I couldn't DM you. Enable DMs from server members and try again.",
			ephemeral: true
		});
		return;
	}

	const subject = renderSubjectTemplate(button.subjectTemplate, button.label, user, modalVars);
	const settings = SettingsService.getAppSettings();

	const openResult = await TicketOpenService.openFromContent({
		user,
		dmChannelId: dm.id,
		messageId: interaction.id,
		content: '',
		executedBy: user.id,
		tag: button.optionalTag,
		subject,
		skipOpeningMessage: true
	});

	OutboundDmGuard.mark(dm.id);
	try {
		await DiscordChannelService.sendComponents(dm.id, await Created.render());
	} finally {
		OutboundDmGuard.unmark(dm.id);
	}

	const templateId = button.templateId.trim() || undefined;
	if (
		templateId &&
		settings.forwardTemplateButtonsToStaff !== false &&
		openResult.staffChannelId
	) {
		await TemplateButtonService.forwardToStaff(
			openResult.staffChannelId,
			templateId,
			user,
			modalVars,
			{
				executedBy: user.id
			}
		);
	}

	await replyChannelPanelTicketAck(interaction, 'opened');
}
