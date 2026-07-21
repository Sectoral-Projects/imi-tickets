import { componentsToTranscriptText } from '@/lib/components/util/transcriptText';
import {
	buildEmbeddedMessageButtonCustomId,
	parseEmbeddedMessageButtonCustomId
} from '@/lib/buttonActions/customIds';
import {
	ButtonMessageDelivery,
	DEFAULT_BUTTON_MESSAGE_DELIVERY,
	type ButtonMessageDelivery as ButtonMessageDeliveryType
} from '@/lib/buttonActions/types';
import { logDmSendFailure } from '@/lib/discord/dmErrors';
import { DiscordChannelService } from './discordChannel';
import { MemberSnapshotService } from './snapshot';
import { MessageService } from './message';
import { MessageTemplateService } from './messageTemplate';
import { ParticipantDmStatusService } from './participantDmStatus';
import { TicketChannelService } from './ticketChannel';
import { TicketService } from './ticket';
import type { ButtonInteraction, ModalSubmitInteraction, User } from 'discord.js';
import { MessageFlags } from 'discord.js';

export {
	TemplateButtonCustomIdPrefix,
	TemplateModalButtonCustomIdPrefix,
	buildEmbeddedMessageButtonCustomId,
	buildEmbeddedModalButtonCustomId,
	buildMessageButtonCustomId,
	parseEmbeddedMessageButtonCustomId,
	parseEmbeddedModalButtonCustomId
} from '@/lib/buttonActions/customIds';

export type ForwardToStaffOptions = {
	executedBy?: string;
};

export type DeliverEmbeddedMessageOptions = ForwardToStaffOptions & {
	messageDelivery?: ButtonMessageDeliveryType | null;
	/** Channel that already received the interaction reply — skip re-sending there. */
	skipChannelId?: string | null;
	presserUserId: string;
	threadId?: number | null;
	staffChannelId?: string | null;
};

export abstract class TemplateButtonService {
	static buildCustomId(parentTemplateId: string, buttonId: string) {
		return buildEmbeddedMessageButtonCustomId(parentTemplateId, buttonId);
	}

	static parseCustomId(customId: string) {
		return parseEmbeddedMessageButtonCustomId(customId);
	}

	static normalizeMessageDelivery(
		value: ButtonMessageDeliveryType | string | null | undefined
	): ButtonMessageDeliveryType {
		switch (value) {
			case ButtonMessageDelivery.Presser:
			case ButtonMessageDelivery.PresserAndStaff:
			case ButtonMessageDelivery.PresserAndParticipants:
			case ButtonMessageDelivery.PresserStaffAndParticipants:
				return value;
			default:
				return DEFAULT_BUTTON_MESSAGE_DELIVERY;
		}
	}

	static deliveryIncludesStaff(delivery: ButtonMessageDeliveryType) {
		return (
			delivery === ButtonMessageDelivery.PresserAndStaff ||
			delivery === ButtonMessageDelivery.PresserStaffAndParticipants
		);
	}

	static deliveryIncludesParticipants(delivery: ButtonMessageDeliveryType) {
		return (
			delivery === ButtonMessageDelivery.PresserAndParticipants ||
			delivery === ButtonMessageDelivery.PresserStaffAndParticipants
		);
	}

	static resolveOpenThreadForInteraction(interaction: ButtonInteraction | ModalSubmitInteraction) {
		if (interaction.inGuild() && interaction.channelId) {
			const byChannel = TicketService.findOpenByStaffChannelId(interaction.channelId);
			if (byChannel) return byChannel;
		}

		return TicketService.findOpenThreadForUser(interaction.user.id);
	}

	static renderForUser(templateId: string, user: User, extraVars: Record<string, unknown> = {}) {
		return MessageTemplateService.renderComponents(templateId, {
			user: user.tag,
			userId: user.id,
			...extraVars
		});
	}

	static async forwardToStaff(
		staffChannelId: string | null | undefined,
		templateId: string,
		user: User,
		extraVars: Record<string, unknown> = {},
		options: ForwardToStaffOptions = {}
	) {
		if (!staffChannelId) return;

		const components = this.renderForUser(templateId, user, extraVars);
		const sentMessage = await DiscordChannelService.sendComponents(staffChannelId, components);
		if (!sentMessage) return;

		const thread = TicketService.findOpenByStaffChannelId(staffChannelId);
		if (!thread) return;

		const body = componentsToTranscriptText(components);
		if (!body) return;

		const executedBy = options.executedBy ?? user.id;
		const snapshot = MemberSnapshotService.capture(user);

		// Attribute as the member (DM). channelId stays the staff channel where Discord
		// stored the copy so relay/delete sync still finds the physical message; the
		// web transcript badge treats member authors as DM even on the staff channel.
		MessageService.create({
			threadId: thread.id,
			channelId: staffChannelId,
			authorId: user.id,
			messageId: sentMessage.id,
			memberSnapshotId: snapshot?.id,
			content: body,
			executedBy
		});
	}

	/** Fan out a linked template according to the per-button delivery preset. */
	static async deliverEmbeddedMessage(
		templateId: string,
		user: User,
		extraVars: Record<string, unknown> = {},
		options: DeliverEmbeddedMessageOptions
	) {
		const delivery = this.normalizeMessageDelivery(options.messageDelivery);
		const skipChannelId = options.skipChannelId ?? null;

		if (this.deliveryIncludesStaff(delivery)) {
			const staffChannelId = options.staffChannelId;
			if (staffChannelId && staffChannelId !== skipChannelId) {
				await this.forwardToStaff(staffChannelId, templateId, user, extraVars, options);
			}
		}

		if (this.deliveryIncludesParticipants(delivery) && options.threadId) {
			await this.forwardToOtherParticipants(templateId, user, extraVars, {
				threadId: options.threadId,
				presserUserId: options.presserUserId,
				skipChannelId,
				executedBy: options.executedBy
			});
		}
	}

	private static async forwardToOtherParticipants(
		templateId: string,
		user: User,
		extraVars: Record<string, unknown>,
		options: {
			threadId: number;
			presserUserId: string;
			skipChannelId?: string | null;
			executedBy?: string;
		}
	) {
		const components = this.renderForUser(templateId, user, extraVars);
		const body = componentsToTranscriptText(components);
		if (!body) return;

		const participants = TicketService.listUserParticipants(options.threadId).filter(
			(participant) => participant.userId !== options.presserUserId
		);

		const executedBy = options.executedBy ?? user.id;
		const snapshot = MemberSnapshotService.capture(user);

		for (const participant of participants) {
			const dmChannel = await TicketChannelService.resolveParticipantDmChannel(
				participant,
				options.threadId
			);
			if (!dmChannel?.isDMBased()) continue;
			if (options.skipChannelId && dmChannel.id === options.skipChannelId) continue;

			const sentMessage = await dmChannel
				.send({
					components,
					flags: MessageFlags.IsComponentsV2
				})
				.catch(async (error) => {
					logDmSendFailure(
						`Failed to forward button message DM for ticket ${options.threadId} to ${participant.userId}`,
						error
					);
					await ParticipantDmStatusService.noteUnreachable(options.threadId, participant.userId, {
						error
					});
					return null;
				});
			if (!sentMessage) continue;

			await ParticipantDmStatusService.noteReachable(options.threadId, participant.userId);

			MessageService.create({
				threadId: options.threadId,
				channelId: dmChannel.id,
				authorId: user.id,
				messageId: sentMessage.id,
				memberSnapshotId: snapshot?.id,
				content: body,
				executedBy
			});
		}
	}
}
