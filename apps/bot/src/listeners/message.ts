import { replyBlocked } from '@/lib/discord/blockedReply';
import { isMessageCommand } from '@/lib/discord/commands';
import { OutboundDmGuard } from '@/lib/discord/outboundDmGuard';
import { requireGuildPermission } from '@/lib/discord/staffCommand';
import { parseStaffTemplateCommand } from '@/lib/discord/templateCommand';
import { extractRelayContent } from '@/lib/discord/relayContent';
import { linkPreviewAttachmentName, isYoutubeThumbnailUrl } from '@/lib/discord/linkPreview';
import { isPrivateStaffMessage, stripPrivateStaffPrefix } from '@/lib/discord/privateStaffMessage';
import { shouldRelayStaffTicketActivity } from '@/lib/discord/ticketRelay';
import { Created } from '@/lib/components/created';
import { TicketOpenPrompt } from '@/lib/components/ticketOpenPrompt';
import { BlockService } from '@/services/block';
import { AttachmentService } from '@/services/attachment';
import { DmButtonCustomIdPrefix, DmOpenButtonService } from '@/services/dmOpenButton';
import { MessageRelayService } from '@/services/messageRelay';
import { MemberSnapshotService } from '@/services/snapshot';
import { MessageService } from '@/services/message';
import { NoteService } from '@/services/note';
import { PendingTicketService } from '@/services/pendingTicket';
import { SettingsService, TicketOpenButtonMode } from '@/services/settings';
import { TicketChannelService } from '@/services/ticketChannel';
import { TicketOpenService } from '@/services/ticketOpen';
import { TicketParticipantService } from '@/services/ticketParticipant';
import { TicketService } from '@/services/ticket';
import { StaffTemplateCommandService } from '@/services/staffTemplateCommand';
import { findBlacklistHit } from '@/lib/wordFilter/match';
import { replyDmWordBlacklist } from '@/lib/wordFilter/replies';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, container } from '@sapphire/framework';
import { ChannelType, Message, MessageFlags } from 'discord.js';

const PRIVATE_STAFF_ACK_EMOJI = '🤫';

@ApplyOptions<Listener.Options>({
	name: 'messageCreate',
	event: Events.MessageCreate
})
export class MessageEvent extends Listener {
	public override async run(message: Message) {
		if (message.partial) {
			await message.fetch().catch(() => null);
		}

		if (!message.author) return;
		if (message.author.bot || message.author.id === container.client.user?.id) return;

		if (message.channel.type === ChannelType.DM) {
			await this.handleDmMessage(message);
			return;
		}

		if (!message.inGuild()) return;

		if (await isMessageCommand(message)) {
			return;
		}

		const templateCommand = await parseStaffTemplateCommand(message);
		if (templateCommand) {
			if (await requireGuildPermission(message)) {
				await StaffTemplateCommandService.execute(message, templateCommand).catch((error) => {
					container.logger.warn('Failed to execute staff template command', error);
				});
			}
			return;
		}

		await this.handleGuildTicketMessage(message);
	}

	private async handleDmMessage(message: Message) {
		if (OutboundDmGuard.isPending(message.channel.id)) return;

		if (await isMessageCommand(message)) return;

		const block = await BlockService.findBlockForUser(message.author.id);
		if (block) {
			await replyBlocked(message, block.reason).catch((error) => {
				container.logger.warn('Failed to send blocked reply in DM', error);
			});
			return;
		}

		if (await this.rejectDmWordBlacklist(message)) return;

		const openThread = TicketService.findOpenThreadForUser(message.author.id);

		if (openThread) {
			const relayResults = openThread.channelId
				? await TicketChannelService.relayMemberMessage(message, openThread)
				: [];
			const primaryRelay = relayResults[0]?.relayMessageId;
			await this.recordMessage(
				message,
				openThread.id,
				message.author,
				primaryRelay,
				undefined,
				relayResults
			);
			return;
		}

		await this.handleNewThreadRequest(message);
	}

	private async rejectDmWordBlacklist(message: Message) {
		const rules = SettingsService.getAppSettings().dmWordBlacklist ?? [];
		const hit = findBlacklistHit(message.content ?? '', rules);
		if (!hit) return false;

		await replyDmWordBlacklist(message, hit).catch((error) => {
			container.logger.warn('Failed to send DM word blacklist rejection', error);
		});
		return true;
	}

	private async handleGuildTicketMessage(message: Message) {
		const thread = TicketService.findOpenByStaffChannelId(message.channel.id);
		if (!thread) return;

		const memberParticipants = TicketService.listUserParticipants(thread.id);
		if (memberParticipants.length === 0) return;

		if (await isMessageCommand(message)) return;

		const shouldRelay = await shouldRelayStaffTicketActivity(message.author.id, thread.userId, message.guildId);
		if (!shouldRelay) return;

		TicketParticipantService.noteStaffActivityInChannel(message.channel.id, message.author.id);

		if (isPrivateStaffMessage(message.content)) {
			await this.acknowledgePrivateStaffMessage(message);
			await this.recordMessage(
				message,
				thread.id,
				message.member ?? message.author,
				undefined,
				stripPrivateStaffPrefix(message.content),
				undefined,
				{ isPrivateStaff: true }
			);
			return;
		}

		const relayResults = await TicketChannelService.relayStaffMessage(message, thread);
		const primaryRelay = relayResults[0]?.relayMessageId;
		await this.recordMessage(
			message,
			thread.id,
			message.member ?? message.author,
			primaryRelay,
			undefined,
			relayResults
		);
	}

	private async acknowledgePrivateStaffMessage(message: Message) {
		await message.react(PRIVATE_STAFF_ACK_EMOJI).catch((error) => {
			container.logger.warn('Failed to acknowledge private staff message', error);
		});
	}

	private async handleNewThreadRequest(message: Message) {
		const block = await BlockService.findBlockForUser(message.author.id);
		if (block) {
			await replyBlocked(message, block.reason).catch((error) => {
				container.logger.warn('Failed to send blocked reply for new thread request', error);
			});
			return;
		}

		const settings = SettingsService.getAppSettings();
		const buttons = DmOpenButtonService.listEnabled();

		if (settings.ticketOpenButtonMode === TicketOpenButtonMode.BeforeOpen && buttons.length > 0) {
			PendingTicketService.save({
				userId: message.author.id,
				dmChannelId: message.channel.id,
				firstMessageId: message.id,
				firstMessageContent: ''
			});

			const prompt = DmOpenButtonService.appendButtonsToComponents(
				await TicketOpenPrompt.render(),
				buttons,
				DmButtonCustomIdPrefix.Open
			);
			await message.reply({ components: prompt, flags: [MessageFlags.IsComponentsV2] });
			return;
		}

		await TicketOpenService.openFromContent({
			user: message.author,
			dmChannelId: message.channel.id,
			messageId: message.id,
			content: message.content,
			discordMessage: message,
			executedBy: message.author.id
		});

		await message.reply({ components: await Created.render(), flags: [MessageFlags.IsComponentsV2] });
	}

	private async recordMessage(
		message: Message,
		threadId: number,
		author: Message['author'] | Message['member'],
		primaryRelayMessageId?: string,
		content?: string,
		relayRecords?: { targetChannelId: string; relayMessageId: string; recipientUserId?: string }[],
		options?: { isPrivateStaff?: boolean }
	) {
		const snapshot = MemberSnapshotService.capture(author ?? message.author);
		const relayContent = extractRelayContent(message);
		const fallbackText =
			relayContent.media.length > 0 || relayContent.linkPreviews.length > 0 ? '' : '(no message content)';
		const storedContent = content ?? (relayContent.text.trim() || fallbackText);
		const replyToMessageId = await MessageService.resolveReplyMessageIdFromDiscordMessage(message, threadId);

		const created = MessageService.create({
			threadId,
			channelId: message.channel.id,
			authorId: message.author.id,
			messageId: message.id,
			relayMessageId: primaryRelayMessageId,
			memberSnapshotId: snapshot.id,
			content: storedContent,
			isForwarded: relayContent.isForwarded,
			isPrivateStaff: options?.isPrivateStaff ?? false,
			replyToMessageId
		});

		if (options?.isPrivateStaff) {
			NoteService.create({
				threadId,
				authorId: message.author.id,
				content: storedContent
			});
		}

		if (relayRecords) {
			for (const relay of relayRecords) {
				MessageRelayService.add({
					messageId: created.id,
					targetChannelId: relay.targetChannelId,
					relayMessageId: relay.relayMessageId,
					recipientUserId: relay.recipientUserId
				});
			}
		} else if (primaryRelayMessageId) {
			const thread = TicketService.findById(threadId);
			const targetChannelId =
				thread?.channelId && message.channel.id === thread.dmChannelId
					? thread.channelId
					: thread?.dmChannelId;
			if (targetChannelId) {
				MessageRelayService.add({
					messageId: created.id,
					targetChannelId,
					relayMessageId: primaryRelayMessageId
				});
			}
		}

		const seen = new Set<string>();
		for (const attachment of relayContent.attachments) {
			if (seen.has(attachment.url)) continue;
			seen.add(attachment.url);
			AttachmentService.create({
				messageId: created.id,
				url: attachment.url,
				name: attachment.name ?? undefined,
				isSpoiler: attachment.isSpoiler
			});
		}

		for (const media of relayContent.media) {
			if (seen.has(media.url)) continue;
			if (relayContent.linkPreviews.length > 0 && isYoutubeThumbnailUrl(media.url)) continue;
			seen.add(media.url);
			AttachmentService.create({
				messageId: created.id,
				url: media.url,
				name: media.description,
				isSpoiler: media.spoiler
			});
		}

		for (const preview of relayContent.linkPreviews) {
			if (seen.has(preview.url)) continue;
			seen.add(preview.url);
			AttachmentService.create({
				messageId: created.id,
				url: preview.url,
				name: linkPreviewAttachmentName(preview)
			});
		}
	}
}
