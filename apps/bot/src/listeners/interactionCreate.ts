import { replyBlocked } from '@/lib/discord/blockedReply';
import { parseStaffPageCustomId, StaffPageButtonPrefix } from '@/lib/discord/staffPagination';
import { canUseStaffPagination, renderStaffPage } from '@/lib/discord/staffPaginationPages';
import {
	buildChannelOpenModalRetryCustomId,
	buildChannelOpenModalSubmitCustomId,
	buildDmOpenModalRetryCustomId,
	buildDmOpenModalSubmitCustomId,
	buildEmbeddedModalRetryCustomId,
	buildEmbeddedModalSubmitCustomId,
	ModalRetryCustomIdPrefix,
	parseEmbeddedMessageButtonCustomId,
	parseEmbeddedModalButtonCustomId,
	parseModalRetryCustomId,
	parseModalSubmitCustomId,
	TemplateModalButtonCustomIdPrefix
} from '@/lib/buttonActions/customIds';
import { replyChannelPanelTicketAck } from '@/lib/discord/channelPanelAck';
import { buildDiscordModal } from '@/lib/buttonActions/modalBuilder';
import { extractModalTemplateVariables } from '@/lib/buttonActions/modalValues';
import {
	ButtonActionType,
	DEFAULT_BUTTON_MESSAGE_DELIVERY,
	type ButtonMessageDelivery
} from '@/lib/buttonActions/types';
import { Closed } from '@/lib/components/closed';
import { NotFound } from '@/lib/components/notFound';
import {
	replyModalWordFilterReject,
	showModalRetryError,
	validateModalFieldsAgainstWordFilters
} from '@/lib/wordFilter/replies';
import { BlockService } from '@/services/block';
import { ButtonActionService } from '@/services/buttonAction';
import { ChannelButtonCustomIdPrefix, ChannelOpenButtonService } from '@/services/channelOpenButton';
import { ChannelPanelService } from '@/services/channelPanel';
import { completeChannelPanelTicketOpen } from '@/services/channelPanelTicketOpen';
import { DmButtonCustomIdPrefix, DmOpenButtonService } from '@/services/dmOpenButton';
import { MessageTemplateService } from '@/services/messageTemplate';
import { PendingTicketService } from '@/services/pendingTicket';
import { SettingsService } from '@/services/settings';
import { TemplateButtonCustomIdPrefix, TemplateButtonService } from '@/services/templateButton';
import { TicketCloseService } from '@/services/ticketClose';
import { TicketOpenService } from '@/services/ticketOpen';
import { TicketService } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import {
	ButtonInteraction,
	Interaction,
	MessageFlags,
	type ModalSubmitInteraction,
	type User
} from 'discord.js';

@ApplyOptions<Listener.Options>({
	name: 'interactionCreate',
	event: Events.InteractionCreate
})
export class InteractionCreateListener extends Listener {
	public override async run(interaction: Interaction) {
		if (interaction.isModalSubmit()) {
			await this.handleModalSubmit(interaction);
			return;
		}

		if (!interaction.isButton()) return;

		if (interaction.customId.startsWith(ModalRetryCustomIdPrefix)) {
			await this.handleModalRetry(interaction);
			return;
		}

		if (interaction.customId.startsWith(StaffPageButtonPrefix)) {
			await this.handleStaffPageButton(interaction);
			return;
		}

		if (interaction.customId.startsWith(DmButtonCustomIdPrefix.Open)) {
			await this.handleOpenButton(interaction, interaction.customId.slice(DmButtonCustomIdPrefix.Open.length));
			return;
		}

		if (interaction.customId.startsWith(ChannelButtonCustomIdPrefix.Open)) {
			await this.handleChannelOpenButton(
				interaction,
				interaction.customId.slice(ChannelButtonCustomIdPrefix.Open.length)
			);
			return;
		}

		if (interaction.customId.startsWith(TemplateModalButtonCustomIdPrefix)) {
			await this.handleEmbeddedModalButton(interaction, interaction.customId);
			return;
		}

		if (interaction.customId.startsWith(TemplateButtonCustomIdPrefix)) {
			await this.handleTemplateButton(interaction, interaction.customId);
		}
	}

	private async handleStaffPageButton(interaction: ButtonInteraction) {
		const state = parseStaffPageCustomId(interaction.customId);
		if (!state) {
			await interaction.reply({ content: 'This pagination control is no longer valid.', ephemeral: true });
			return;
		}

		if (!(await canUseStaffPagination(interaction.user.id, interaction.guildId))) {
			await interaction.reply({ content: 'You do not have permission to use this control.', ephemeral: true });
			return;
		}

		const components = renderStaffPage(state.kind, state.page, state.context);
		await interaction.update({ components, flags: [MessageFlags.IsComponentsV2] });
	}

	private async handleOpenButton(interaction: ButtonInteraction, buttonId: string) {
		const block = await BlockService.findBlockForUser(interaction.user.id);
		if (block) {
			await replyBlocked(interaction, block.reason);
			return;
		}

		const existing = TicketService.findOpenThreadForUser(interaction.user.id);
		if (existing) {
			await interaction.reply({
				content: 'You already have an open ticket. Please continue in this DM.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const pending = PendingTicketService.find(interaction.user.id);
		if (!pending) {
			await interaction.reply({
				content: 'That ticket request expired. Send a new message to start again.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const button = DmOpenButtonService.find(buttonId);
		if (!button?.enabled) {
			await interaction.reply({
				content: 'That option is no longer available. Send a new message to start again.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		if (button.actionType === ButtonActionType.Modal) {
			const modalConfig = ButtonActionService.resolveModal({
				actionType: ButtonActionType.Modal,
				templateId: button.templateId.trim() || undefined,
				modalTemplateId: button.modalTemplateId?.trim() || undefined,
				modal: button.modalConfig ?? undefined
			});
			if (!modalConfig) {
				await interaction.reply({
					content: 'That option is no longer available. Send a new message to start again.',
					ephemeral: interaction.inGuild()
				});
				return;
			}

			await interaction.showModal(
				buildDiscordModal(buildDmOpenModalSubmitCustomId(buttonId), modalConfig)
			);
			return;
		}

		const settings = SettingsService.getAppSettings();
		const openResult = await TicketOpenService.openFromContent({
			user: interaction.user,
			dmChannelId: pending.dmChannelId,
			messageId: interaction.id,
			content: '',
			executedBy: interaction.user.id,
			tag: button.optionalTag,
			subject: button.label,
			skipOpeningMessage: true
		});
		PendingTicketService.delete(interaction.user.id);

		await this.replyWithOptionalTemplate(
			interaction,
			button.templateId.trim() || undefined,
			interaction.user,
			{},
			settings,
			openResult.staffChannelId
		);
	}

	private async handleChannelOpenButton(interaction: ButtonInteraction, buttonId: string) {
		if (!interaction.inGuild()) {
			await interaction.reply({
				content: 'This button can only be used in a server channel.',
				ephemeral: true
			});
			return;
		}

		const panelConfig = ChannelPanelService.getConfig();
		if (!panelConfig.enabled) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: true
			});
			return;
		}

		const block = await BlockService.findBlockForUser(interaction.user.id);
		if (block) {
			await replyBlocked(interaction, block.reason);
			return;
		}

		const existing = TicketService.findOpenThreadForUser(interaction.user.id);
		if (existing) {
			await replyChannelPanelTicketAck(interaction, 'existing_open');
			return;
		}

		const button = ChannelOpenButtonService.find(buttonId);
		if (!button?.enabled) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: true
			});
			return;
		}

		if (button.actionType === ButtonActionType.Modal) {
			const modalConfig = ButtonActionService.resolveModal({
				actionType: ButtonActionType.Modal,
				templateId: button.templateId.trim() || undefined,
				modalTemplateId: button.modalTemplateId?.trim() || undefined,
				modal: button.modalConfig ?? undefined
			});
			if (!modalConfig) {
				await interaction.reply({
					content: 'That option is no longer available.',
					ephemeral: true
				});
				return;
			}

			await interaction.showModal(
				buildDiscordModal(buildChannelOpenModalSubmitCustomId(buttonId), modalConfig)
			);
			return;
		}

		await completeChannelPanelTicketOpen(interaction, interaction.user, button, {});
	}

	private async handleEmbeddedModalButton(interaction: ButtonInteraction, customId: string) {
		const parsed = parseEmbeddedModalButtonCustomId(customId);
		if (!parsed) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const action = ButtonActionService.getEmbedded(parsed.templateId, parsed.buttonId);
		const modalConfig = ButtonActionService.resolveModal(action);
		if (action?.actionType !== ButtonActionType.Modal || !modalConfig) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		await interaction.showModal(
			buildDiscordModal(
				buildEmbeddedModalSubmitCustomId(parsed.templateId, parsed.buttonId),
				modalConfig
			)
		);
	}

	private async handleTemplateButton(interaction: ButtonInteraction, customId: string) {
		const parsed = parseEmbeddedMessageButtonCustomId(customId);
		if (!parsed) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		if (parsed.kind === 'legacy') {
			await this.handleLegacyTemplateButton(interaction, parsed.linkedTemplateId);
			return;
		}

		const action = ButtonActionService.getEmbedded(parsed.templateId, parsed.buttonId);
		if (!action || (action.actionType !== ButtonActionType.Message && action.actionType !== ButtonActionType.Modal)) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		if (action.actionType === ButtonActionType.Modal) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const linkedTemplateId = action.templateId?.trim() || '';
		const closeTicketOnPress = Boolean(action.closeTicketOnPress);

		if (!linkedTemplateId && !closeTicketOnPress) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const thread = TemplateButtonService.resolveOpenThreadForInteraction(interaction);
		let replied = false;

		if (linkedTemplateId) {
			let components;
			try {
				components = TemplateButtonService.renderForUser(linkedTemplateId, interaction.user);
			} catch {
				await interaction.reply({
					content: 'That template is not configured.',
					ephemeral: interaction.inGuild()
				});
				return;
			}

			await interaction.reply({
				components,
				flags: [MessageFlags.IsComponentsV2]
			});
			replied = true;

			await TemplateButtonService.deliverEmbeddedMessage(linkedTemplateId, interaction.user, {}, {
				messageDelivery: action.messageDelivery,
				presserUserId: interaction.user.id,
				threadId: thread?.id,
				staffChannelId: thread?.channelId,
				skipChannelId: interaction.channelId,
				executedBy: interaction.user.id
			});
		}

		if (closeTicketOnPress) {
			await this.applyCloseTicketSideEffect(interaction, thread, replied);
			return;
		}
	}

	private async handleLegacyTemplateButton(interaction: ButtonInteraction, linkedTemplateId: string) {
		const trimmedId = linkedTemplateId.trim();
		if (!trimmedId) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const template = MessageTemplateService.get(trimmedId);
		if (!template?.template) {
			await interaction.reply({
				content: 'That template is not configured.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		let components;
		try {
			components = TemplateButtonService.renderForUser(trimmedId, interaction.user);
		} catch {
			await interaction.reply({
				content: 'That template is not configured.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		await interaction.reply({
			components,
			flags: [MessageFlags.IsComponentsV2]
		});

		const thread = TemplateButtonService.resolveOpenThreadForInteraction(interaction);
		await TemplateButtonService.deliverEmbeddedMessage(trimmedId, interaction.user, {}, {
			messageDelivery: DEFAULT_BUTTON_MESSAGE_DELIVERY,
			presserUserId: interaction.user.id,
			threadId: thread?.id,
			staffChannelId: thread?.channelId,
			skipChannelId: interaction.channelId,
			executedBy: interaction.user.id
		});
	}

	private async applyCloseTicketSideEffect(
		interaction: ButtonInteraction | ModalSubmitInteraction,
		thread: ReturnType<typeof TemplateButtonService.resolveOpenThreadForInteraction>,
		alreadyReplied: boolean
	) {
		const ephemeral = interaction.inGuild();
		const send = async (payload: {
			content?: string;
			components?: Awaited<ReturnType<typeof Closed.render>>;
		}) => {
			const flags = payload.components
				? ephemeral
					? ([MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] as const)
					: ([MessageFlags.IsComponentsV2] as const)
				: ephemeral
					? ([MessageFlags.Ephemeral] as const)
					: undefined;

			if (alreadyReplied) {
				await interaction.followUp({
					...payload,
					...(flags ? { flags } : {})
				});
				return;
			}

			await interaction.reply({
				...payload,
				...(flags ? { flags } : {})
			});
		};

		if (!thread) {
			await send({ components: await NotFound.render() });
			return;
		}

		const skipMemberDm = !interaction.inGuild();
		await TicketCloseService.close({
			threadId: thread.id,
			executedBy: interaction.user.id,
			skipMemberDm
		});

		await send({ components: await Closed.render() });
	}

	private async handleModalSubmit(interaction: ModalSubmitInteraction) {
		const parsed = parseModalSubmitCustomId(interaction.customId);
		if (!parsed) return;

		if (parsed.kind === 'dm') {
			await this.handleDmOpenModalSubmit(interaction, parsed.buttonId);
			return;
		}

		if (parsed.kind === 'channel') {
			await this.handleChannelOpenModalSubmit(interaction, parsed.buttonId);
			return;
		}

		await this.handleEmbeddedModalSubmit(interaction, parsed.templateId, parsed.buttonId);
	}

	private async handleDmOpenModalSubmit(interaction: ModalSubmitInteraction, buttonId: string) {
		const block = await BlockService.findBlockForUser(interaction.user.id);
		if (block) {
			await replyBlocked(interaction, block.reason);
			return;
		}

		const existing = TicketService.findOpenThreadForUser(interaction.user.id);
		if (existing) {
			await interaction.reply({
				content: 'You already have an open ticket. Please continue in this DM.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const pending = PendingTicketService.find(interaction.user.id);
		if (!pending) {
			await interaction.reply({
				content: 'That ticket request expired. Send a new message to start again.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const button = DmOpenButtonService.find(buttonId);
		const modalConfig = ButtonActionService.resolveModal(
			button
				? {
						actionType: ButtonActionType.Modal,
						templateId: button.templateId.trim() || undefined,
						modalTemplateId: button.modalTemplateId?.trim() || undefined,
						modal: button.modalConfig ?? undefined
					}
				: null
		);
		if (!button?.enabled || button.actionType !== ButtonActionType.Modal || !modalConfig) {
			await interaction.reply({
				content: 'That option is no longer available. Send a new message to start again.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const modalVars = extractModalTemplateVariables(modalConfig.fields, interaction);
		const filterResult = validateModalFieldsAgainstWordFilters(modalConfig.fields, modalVars);
		if (!filterResult.ok) {
			await replyModalWordFilterReject(interaction, {
				...filterResult,
				retryCustomId: buildDmOpenModalRetryCustomId(buttonId)
			});
			return;
		}

		const settings = SettingsService.getAppSettings();
		const openResult = await TicketOpenService.openFromContent({
			user: interaction.user,
			dmChannelId: pending.dmChannelId,
			messageId: interaction.id,
			content: '',
			executedBy: interaction.user.id,
			tag: button.optionalTag,
			subject: button.label,
			skipOpeningMessage: true
		});
		PendingTicketService.delete(interaction.user.id);

		await this.replyWithOptionalTemplate(
			interaction,
			button.templateId.trim() || undefined,
			interaction.user,
			modalVars,
			settings,
			openResult.staffChannelId
		);
	}

	private async handleChannelOpenModalSubmit(interaction: ModalSubmitInteraction, buttonId: string) {
		const panelConfig = ChannelPanelService.getConfig();
		if (!panelConfig.enabled) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const block = await BlockService.findBlockForUser(interaction.user.id);
		if (block) {
			await replyBlocked(interaction, block.reason);
			return;
		}

		const existing = TicketService.findOpenThreadForUser(interaction.user.id);
		if (existing) {
			await replyChannelPanelTicketAck(interaction, 'existing_open');
			return;
		}

		const button = ChannelOpenButtonService.find(buttonId);
		const modalConfig = ButtonActionService.resolveModal(
			button
				? {
						actionType: ButtonActionType.Modal,
						templateId: button.templateId.trim() || undefined,
						modalTemplateId: button.modalTemplateId?.trim() || undefined,
						modal: button.modalConfig ?? undefined
					}
				: null
		);
		if (!button?.enabled || button.actionType !== ButtonActionType.Modal || !modalConfig) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const modalVars = extractModalTemplateVariables(modalConfig.fields, interaction);
		const filterResult = validateModalFieldsAgainstWordFilters(modalConfig.fields, modalVars);
		if (!filterResult.ok) {
			await replyModalWordFilterReject(interaction, {
				...filterResult,
				retryCustomId: buildChannelOpenModalRetryCustomId(buttonId)
			});
			return;
		}

		await completeChannelPanelTicketOpen(interaction, interaction.user, button, modalVars);
	}

	private async handleEmbeddedModalSubmit(
		interaction: ModalSubmitInteraction,
		templateId: string,
		buttonId: string
	) {
		const action = ButtonActionService.getEmbedded(templateId, buttonId);
		const modalConfig = ButtonActionService.resolveModal(action);
		if (action?.actionType !== ButtonActionType.Modal || !modalConfig) {
			await interaction.reply({
				content: 'That option is no longer available.',
				ephemeral: interaction.inGuild()
			});
			return;
		}

		const modalVars = extractModalTemplateVariables(modalConfig.fields, interaction);
		const filterResult = validateModalFieldsAgainstWordFilters(modalConfig.fields, modalVars);
		if (!filterResult.ok) {
			await replyModalWordFilterReject(interaction, {
				...filterResult,
				retryCustomId: buildEmbeddedModalRetryCustomId(templateId, buttonId)
			});
			return;
		}

		const thread = TemplateButtonService.resolveOpenThreadForInteraction(interaction);

		await this.replyWithOptionalTemplate(
			interaction,
			action.templateId,
			interaction.user,
			modalVars,
			SettingsService.getAppSettings(),
			thread?.channelId,
			{
				messageDelivery: action.messageDelivery,
				threadId: thread?.id ?? null,
				presserUserId: interaction.user.id,
				skipChannelId: interaction.channelId
			}
		);

		if (action.closeTicketOnPress) {
			await this.applyCloseTicketSideEffect(interaction, thread, true);
		}
	}

	private async handleModalRetry(interaction: ButtonInteraction) {
		const parsed = parseModalRetryCustomId(interaction.customId);
		if (!parsed) {
			await showModalRetryError(interaction, 'That retry control is no longer valid.');
			return;
		}

		if (parsed.kind === 'dm') {
			const pending = PendingTicketService.find(interaction.user.id);
			if (!pending) {
				await showModalRetryError(
					interaction,
					'That ticket request expired. Send a new message to start again.'
				);
				return;
			}

			const button = DmOpenButtonService.find(parsed.buttonId);
			const modalConfig = ButtonActionService.resolveModal(
				button
					? {
							actionType: ButtonActionType.Modal,
							templateId: button.templateId.trim() || undefined,
							modalTemplateId: button.modalTemplateId?.trim() || undefined,
							modal: button.modalConfig ?? undefined
						}
					: null
			);
			if (!button?.enabled || button.actionType !== ButtonActionType.Modal || !modalConfig) {
				await showModalRetryError(
					interaction,
					'That option is no longer available. Send a new message to start again.'
				);
				return;
			}

			await interaction.showModal(buildDiscordModal(buildDmOpenModalSubmitCustomId(parsed.buttonId), modalConfig));
			return;
		}

		if (parsed.kind === 'channel') {
			const button = ChannelOpenButtonService.find(parsed.buttonId);
			const modalConfig = ButtonActionService.resolveModal(
				button
					? {
							actionType: ButtonActionType.Modal,
							templateId: button.templateId.trim() || undefined,
							modalTemplateId: button.modalTemplateId?.trim() || undefined,
							modal: button.modalConfig ?? undefined
						}
					: null
			);
			if (!button?.enabled || button.actionType !== ButtonActionType.Modal || !modalConfig) {
				await showModalRetryError(interaction, 'That option is no longer available.');
				return;
			}

			await interaction.showModal(
				buildDiscordModal(buildChannelOpenModalSubmitCustomId(parsed.buttonId), modalConfig)
			);
			return;
		}

		const action = ButtonActionService.getEmbedded(parsed.templateId, parsed.buttonId);
		const modalConfig = ButtonActionService.resolveModal(action);
		if (action?.actionType !== ButtonActionType.Modal || !modalConfig) {
			await showModalRetryError(interaction, 'That option is no longer available.');
			return;
		}

		await interaction.showModal(
			buildDiscordModal(buildEmbeddedModalSubmitCustomId(parsed.templateId, parsed.buttonId), modalConfig)
		);
	}

	private async replyWithOptionalTemplate(
		interaction: ButtonInteraction | ModalSubmitInteraction,
		templateId: string | undefined,
		user: User,
		extraVars: Record<string, unknown>,
		settings: ReturnType<typeof SettingsService.getAppSettings>,
		staffChannelId?: string | null,
		embeddedDelivery?: {
			messageDelivery?: ButtonMessageDelivery | null;
			threadId?: number | null;
			presserUserId: string;
			skipChannelId?: string | null;
		}
	) {
		if (templateId) {
			try {
				const components = TemplateButtonService.renderForUser(templateId, user, extraVars);
				await interaction.reply({
					components,
					flags: [MessageFlags.IsComponentsV2]
				});

				if (embeddedDelivery) {
					await TemplateButtonService.deliverEmbeddedMessage(templateId, user, extraVars, {
						messageDelivery: embeddedDelivery.messageDelivery,
						presserUserId: embeddedDelivery.presserUserId,
						threadId: embeddedDelivery.threadId,
						staffChannelId,
						skipChannelId: embeddedDelivery.skipChannelId ?? interaction.channelId,
						executedBy: user.id
					});
				} else if (settings.forwardTemplateButtonsToStaff !== false && staffChannelId) {
					await TemplateButtonService.forwardToStaff(staffChannelId, templateId, user, extraVars, {
						executedBy: user.id
					});
				}
				return;
			} catch {
				// Fall through to plain acknowledgement.
			}
		}

		if (interaction.isModalSubmit()) {
			await interaction.reply({ content: 'Submitted.' });
			return;
		}

		await interaction.reply({
			content: 'Your ticket has been opened. Send a message here to continue.'
		});
	}
}
