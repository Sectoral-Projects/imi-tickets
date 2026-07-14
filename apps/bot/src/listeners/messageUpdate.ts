import { extractRelayContent } from '@/lib/discord/relayContent';
import { isYoutubeThumbnailUrl, linkPreviewAttachmentName } from '@/lib/discord/linkPreview';
import { isPrivateStaffMessage, stripPrivateStaffPrefix } from '@/lib/discord/privateStaffMessage';
import { shouldRelayStaffTicketActivity } from '@/lib/discord/ticketRelay';
import { AttachmentService } from '@/services/attachment';
import { MessageService } from '@/services/message';
import { TicketChannelService } from '@/services/ticketChannel';
import { TicketService, ThreadStatus } from '@/services/ticket';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, type Message, type PartialMessage } from 'discord.js';

@ApplyOptions<Listener.Options>({
	name: 'messageUpdate',
	event: Events.MessageUpdate
})
export class MessageUpdateEvent extends Listener {
	public override async run(_oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
		if (newMessage.author?.bot) return;

		const resolved =
			newMessage.partial ?
				await newMessage.fetch().catch(() => null)
			:	newMessage;
		if (!resolved) return;

		const stored = MessageService.findStoredMessageByDiscordId(resolved.id);
		if (!stored) return;

		const thread = TicketService.findById(stored.threadId);
		if (!thread || thread.status !== ThreadStatus.Open) return;

		if (resolved.inGuild()) {
			const shouldRelay = await shouldRelayStaffTicketActivity(
				resolved.author.id,
				thread.userId,
				resolved.guildId!
			);
			if (!shouldRelay) return;
		} else if (resolved.channel.type !== ChannelType.DM) {
			return;
		}

		const isPrivate = resolved.inGuild() && isPrivateStaffMessage(resolved.content);
		const relayContent = extractRelayContent(resolved);
		const fallbackText =
			relayContent.media.length > 0 || relayContent.linkPreviews.length > 0 ? '' : '(no message content)';
		const content = isPrivate
			? stripPrivateStaffPrefix(resolved.content)
			: relayContent.text.trim() || fallbackText;

		const contentChanged = stored.content !== content;
		const previousEmbedCount =
			'embeds' in _oldMessage && Array.isArray(_oldMessage.embeds) ? _oldMessage.embeds.length : 0;
		const alreadyRelayedMedia = AttachmentService.listForMessage(stored.id).length > 0;
		// Discord often re-emits messageUpdate with empty old embeds even when create already
		// had them — skip if we already persisted media from the initial relay.
		const embedsNewlyAvailable =
			!isPrivate &&
			relayContent.media.length > 0 &&
			previousEmbedCount === 0 &&
			resolved.embeds.length > 0 &&
			!alreadyRelayedMedia;

		if (!contentChanged && !embedsNewlyAvailable) return;

		const updated = contentChanged
			? MessageService.edit({
					id: stored.id,
					content,
					executedBy: resolved.author.id
				})
			: stored;
		if (!updated) return;

		if (!isPrivate && (contentChanged || embedsNewlyAvailable)) {
			persistNewRelayAttachments(updated.id, relayContent);
		}

		if (isPrivate) return;

		// Rematerialize media whenever this update is responsible for showing it. Always clear
		// prior Discord attachments when uploading files — otherwise the gallery doubles.
		const shouldAttachMedia =
			embedsNewlyAvailable || (contentChanged && relayContent.media.length > 0);

		await TicketChannelService.updateRelayMessage(
			{ ...stored, ...updated, content },
			thread,
			{
				staffAuthorLabel: resolved.inGuild()
					? await TicketChannelService.staffAuthorLabel(resolved)
					: undefined,
				memberTag: resolved.author.tag,
				media: shouldAttachMedia ? relayContent.media : undefined,
				linkPreviews: shouldAttachMedia ? relayContent.linkPreviews : undefined,
				replaceAttachments: shouldAttachMedia
			}
		);
	}
}

function persistNewRelayAttachments(
	messageId: number,
	relayContent: ReturnType<typeof extractRelayContent>
) {
	const existing = new Set(AttachmentService.listForMessage(messageId).map((row) => row.url));

	for (const attachment of relayContent.attachments) {
		if (existing.has(attachment.url)) continue;
		existing.add(attachment.url);
		AttachmentService.create({
			messageId,
			url: attachment.url,
			name: attachment.name ?? undefined,
			isSpoiler: attachment.isSpoiler,
			width: attachment.width,
			height: attachment.height
		});
	}

	for (const media of relayContent.media) {
		if (existing.has(media.url)) continue;
		if (relayContent.linkPreviews.length > 0 && isYoutubeThumbnailUrl(media.url)) continue;
		existing.add(media.url);
		AttachmentService.create({
			messageId,
			url: media.url,
			name: media.description,
			isSpoiler: media.spoiler,
			width: media.width,
			height: media.height
		});
	}

	for (const preview of relayContent.linkPreviews) {
		if (existing.has(preview.url)) continue;
		existing.add(preview.url);
		AttachmentService.create({
			messageId,
			url: preview.url,
			name: linkPreviewAttachmentName(preview)
		});
	}
}
