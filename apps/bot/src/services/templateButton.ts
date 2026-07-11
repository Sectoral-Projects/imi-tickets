import { componentsToTranscriptText } from '@/lib/components/util/transcriptText';
import {
	formatModalResponseTranscript,
	resolveTranscriptUserLabel,
	TRANSCRIPT_SYSTEM_AUTHOR_ID
} from '@/lib/transcript/systemMessage';
import { DiscordChannelService } from './discordChannel';
import { MemberSnapshotService } from './snapshot';
import { MessageService } from './message';
import { MessageTemplateService } from './messageTemplate';
import { TicketService } from './ticket';
import type { User } from 'discord.js';

export {
	TemplateButtonCustomIdPrefix,
	TemplateModalButtonCustomIdPrefix,
	buildEmbeddedModalButtonCustomId,
	buildMessageButtonCustomId,
	parseEmbeddedModalButtonCustomId
} from '@/lib/buttonActions/customIds';

export type ForwardToStaffOptions = {
	/** When true, transcript row is attributed to System with "Answered by …". */
	modalResponse?: boolean;
	executedBy?: string;
};

export abstract class TemplateButtonService {
	static buildCustomId(templateId: string) {
		return `msg_btn:${templateId}`;
	}

	static parseCustomId(customId: string) {
		const prefix = 'msg_btn:';
		if (!customId.startsWith(prefix)) return null;
		const templateId = customId.slice(prefix.length).trim();
		return templateId.length > 0 ? templateId : null;
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
		const modalResponse = options.modalResponse ?? false;
		const content = modalResponse
			? formatModalResponseTranscript(resolveTranscriptUserLabel(user), body)
			: body;

		const snapshot = modalResponse ? undefined : MemberSnapshotService.capture(user);

		MessageService.create({
			threadId: thread.id,
			channelId: staffChannelId,
			authorId: modalResponse ? TRANSCRIPT_SYSTEM_AUTHOR_ID : user.id,
			messageId: sentMessage.id,
			memberSnapshotId: snapshot?.id,
			content,
			executedBy
		});
	}
}
