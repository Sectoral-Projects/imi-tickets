import { componentsToTranscriptText } from '@/lib/components/util/transcriptText';
import { DiscordChannelService } from './discordChannel';
import { MemberSnapshotService } from './snapshot';
import { MessageRelayService } from './messageRelay';
import { MessageService } from './message';
import { MessageTemplateService, type MessageTemplateView } from './messageTemplate';
import { TicketChannelService } from './ticketChannel';
import { TicketService } from './ticket';
import { container } from '@sapphire/framework';
import { MessageFlags, type Message } from 'discord.js';
import type { DbClient } from './types';

export abstract class StaffTemplateCommandService {
	static async execute(
		message: Message,
		template: MessageTemplateView,
		db: DbClient = container.sqlite
	) {
		const thread = TicketService.findOpenByStaffChannelId(message.channel.id, db);
		const vars = {
			staff: message.member?.displayName ?? message.author.tag,
			staffId: message.author.id,
			user: message.member?.displayName ?? message.author.tag,
			userId: message.author.id,
			ticketId: thread ? String(thread.id) : '',
			ticketSubject: thread?.subject ?? ''
		};

		const components = MessageTemplateService.renderComponents(template.id, vars, db);
		const staffMessage = await DiscordChannelService.sendComponents(message.channel.id, components);
		if (!staffMessage) {
			throw new Error('Failed to send the template message.');
		}

		const relayDeliveries: {
			targetChannelId: string;
			relayMessageId: string;
			recipientUserId?: string;
		}[] = [];

		if (thread) {
			const participants = TicketService.listUserParticipants(thread.id, db);
			for (const participant of participants) {
				const dmChannel = await TicketChannelService.resolveParticipantDmChannel(participant, thread.id, db);
				if (!dmChannel?.isDMBased()) continue;

				const dmMessage = await dmChannel
					.send({
						components,
						flags: MessageFlags.IsComponentsV2
					})
					.catch(() => null);

				if (!dmMessage) continue;

				relayDeliveries.push({
					targetChannelId: dmChannel.id,
					relayMessageId: dmMessage.id,
					recipientUserId: participant.userId
				});
			}

			const snapshot = MemberSnapshotService.capture(message.member ?? message.author);
			const created = MessageService.create({
				threadId: thread.id,
				channelId: message.channel.id,
				authorId: message.author.id,
				messageId: staffMessage.id,
				memberSnapshotId: snapshot.id,
				content: componentsToTranscriptText(components) || template.name,
				executedBy: message.author.id
			});

			const primaryRelay = relayDeliveries[0];
			if (primaryRelay) {
				MessageService.setRelayMessageId(created.id, primaryRelay.relayMessageId, db);
			}

			for (const relay of relayDeliveries) {
				MessageRelayService.add(
					{
						messageId: created.id,
						targetChannelId: relay.targetChannelId,
						relayMessageId: relay.relayMessageId,
						recipientUserId: relay.recipientUserId
					},
					db
				);
			}
		}

		await message.delete().catch(() => null);
	}
}
