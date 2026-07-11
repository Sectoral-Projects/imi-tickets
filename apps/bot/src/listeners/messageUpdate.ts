import { extractRelayContent } from '@/lib/discord/relayContent';
import { isPrivateStaffMessage, stripPrivateStaffPrefix } from '@/lib/discord/privateStaffMessage';
import { shouldRelayStaffTicketActivity } from '@/lib/discord/ticketRelay';
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

		if (stored.content === content) return;

		const updated = MessageService.edit({
			id: stored.id,
			content,
			executedBy: resolved.author.id
		});
		if (!updated) return;

		if (isPrivate) return;

		await TicketChannelService.updateRelayMessage(
			{ ...stored, ...updated },
			thread,
			{
				staffAuthorLabel: resolved.inGuild()
					? await TicketChannelService.staffAuthorLabel(resolved)
					: undefined,
				memberTag: resolved.author.tag
			}
		);
	}
}
