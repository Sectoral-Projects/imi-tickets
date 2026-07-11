import { MemberSnapshotService } from './snapshot';
import { MessageService } from './message';
import { AttachmentService } from './attachment';
import { TicketChannelService } from './ticketChannel';
import { TicketService, ParticipantRole } from './ticket';
import { TranscriptService } from './transcript';
import { TRANSCRIPT_SYSTEM_AUTHOR_ID, TRANSCRIPT_SYSTEM_AUTHOR_LABEL } from '@/lib/transcript/systemMessage';
import { DiscordChannelService } from './discordChannel';
import { componentsToTranscriptText } from '@/lib/components/util/transcriptText';
import { StaffContact, STAFF_CONTACT_NOTICE } from '@/lib/components/staffContact';
import { OutboundDmGuard } from '@/lib/discord/outboundDmGuard';
import { extractRelayContent } from '@/lib/discord/relayContent';
import { linkPreviewAttachmentName, isYoutubeThumbnailUrl } from '@/lib/discord/linkPreview';
import type { Message, User } from 'discord.js';

export interface OpenTicketFromContentInput {
	user: User;
	dmChannelId: string;
	messageId: string;
	content: string;
	executedBy: string;
	tag?: string | null;
	subject?: string;
	hideMemberIdentities?: boolean;
	/** When true, the opening transcript row is attributed to System (staff-initiated contact). */
	staffContactOpening?: boolean;
	/** When true, do not record or relay the opening DM message (e.g. before-open button flow). */
	skipOpeningMessage?: boolean;
	/** Full Discord message when available — used for forwards, attachments, and embeds. */
	discordMessage?: Message;
}

export interface OpenGroupContactInput {
	users: User[];
	executedBy: string;
	subject?: string;
	hideMemberIdentities?: boolean;
	content?: string;
}

export abstract class TicketOpenService {
	static async openFromContent(input: OpenTicketFromContentInput) {
		const thread = TicketService.create({
			userId: input.user.id,
			dmChannelId: input.dmChannelId,
			executedBy: input.executedBy,
			subject: input.subject,
			hideMemberIdentities: input.hideMemberIdentities ?? false
		});

		const openingRelay =
			!input.skipOpeningMessage && input.discordMessage ? extractRelayContent(input.discordMessage) : null;
		const isStaffContact = input.staffContactOpening ?? false;

		const staffChannel = await TicketChannelService.provisionFromContent(
			input.user,
			input.skipOpeningMessage ? null : input.content,
			isStaffContact ? TRANSCRIPT_SYSTEM_AUTHOR_LABEL : input.user.tag,
			undefined,
			thread.id,
			openingRelay
		);
		if (staffChannel) {
			TicketService.setStaffChannel(thread.id, staffChannel.channelId, staffChannel.name);
		}

		if (!input.skipOpeningMessage && !isStaffContact) {
			const fallbackText =
				openingRelay && (openingRelay.media.length > 0 || openingRelay.linkPreviews.length > 0)
					? ''
					: '(no message content)';
			const storedContent = openingRelay?.text.trim() || input.content.trim() || fallbackText;
			const snapshot = isStaffContact ? undefined : MemberSnapshotService.capture(input.user);
			const created = MessageService.create({
				threadId: thread.id,
				channelId: isStaffContact && staffChannel ? staffChannel.channelId : input.dmChannelId,
				authorId: isStaffContact ? TRANSCRIPT_SYSTEM_AUTHOR_ID : input.user.id,
				messageId: input.messageId,
				memberSnapshotId: snapshot?.id,
				content: storedContent,
				isForwarded: openingRelay?.isForwarded ?? false,
				executedBy: input.executedBy
			});

			if (openingRelay) {
				persistRelayAttachments(created.id, openingRelay);
			}
		}

		if (input.tag) {
			TicketService.addTag(thread.id, input.tag, input.executedBy);
		}

		await TranscriptService.sendTicketOpened(thread, input.user);

		return {
			thread,
			staffChannelId: staffChannel?.channelId ?? null
		};
	}

	static async openGroupContact(input: OpenGroupContactInput) {
		if (input.users.length === 0) {
			throw new Error('At least one user is required to open a group contact ticket.');
		}

		const primary = input.users[0]!;
		const primaryDm = await primary.createDM().catch(() => null);
		if (!primaryDm) {
			throw new Error(`Could not open DM with ${primary.tag}.`);
		}

		const thread = TicketService.create({
			userId: primary.id,
			dmChannelId: primaryDm.id,
			executedBy: input.executedBy,
			subject: input.subject ?? 'Staff contact',
			hideMemberIdentities: input.hideMemberIdentities ?? false
		});

		const staffChannel = await TicketChannelService.provisionFromContent(
			primary,
			STAFF_CONTACT_NOTICE,
			TRANSCRIPT_SYSTEM_AUTHOR_LABEL,
			undefined,
			thread.id
		);
		if (staffChannel) {
			TicketService.setStaffChannel(thread.id, staffChannel.channelId, staffChannel.name);
		}

		for (const user of input.users.slice(1)) {
			const dm = await user.createDM().catch(() => null);
			if (!dm) continue;

			TicketService.addParticipant(thread.id, user.id, ParticipantRole.User, {
				dmChannelId: dm.id,
				executedBy: input.executedBy
			});
		}

		await TranscriptService.sendTicketOpened(thread, primary);

		return { thread, staffChannelId: staffChannel?.channelId ?? null };
	}

	static async sendStaffContactDm(
		threadId: number,
		dmChannelId: string,
		executedBy: string,
		options: { recordTranscript?: boolean } = {}
	) {
		const recordTranscript = options.recordTranscript ?? true;
		const components = await StaffContact.render();
		OutboundDmGuard.mark(dmChannelId);

		try {
			const sent = await DiscordChannelService.sendComponents(dmChannelId, components);
			if (!sent) return;

			if (recordTranscript) {
				MessageService.create({
					threadId,
					channelId: dmChannelId,
					authorId: TRANSCRIPT_SYSTEM_AUTHOR_ID,
					messageId: sent.id,
					content: componentsToTranscriptText(components) || STAFF_CONTACT_NOTICE,
					executedBy
				});
			}
		} finally {
			OutboundDmGuard.unmark(dmChannelId);
		}
	}
}

function persistRelayAttachments(messageId: number, relayContent: ReturnType<typeof extractRelayContent>) {
	const seen = new Set<string>();

	for (const attachment of relayContent.attachments) {
		if (seen.has(attachment.url)) continue;
		seen.add(attachment.url);
		AttachmentService.create({
			messageId,
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
			messageId,
			url: media.url,
			name: media.description,
			isSpoiler: media.spoiler
		});
	}

	for (const preview of relayContent.linkPreviews) {
		if (seen.has(preview.url)) continue;
		seen.add(preview.url);
		AttachmentService.create({
			messageId,
			url: preview.url,
			name: linkPreviewAttachmentName(preview)
		});
	}
}
