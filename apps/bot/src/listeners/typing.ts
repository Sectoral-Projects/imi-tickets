import { shouldRelayStaffTicketActivity } from '@/lib/discord/ticketRelay';
import { SettingsService } from '@/services/settings';
import { TicketChannelService } from '@/services/ticketChannel';
import { TicketService } from '@/services/ticket';
import { MemberSnapshotService } from '@/services/snapshot';
import { RealtimeService } from '@/services/realtime';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType } from 'discord.js';

const STAFF_CHANNEL_TYPES = new Set<ChannelType>([
	ChannelType.GuildText,
	ChannelType.PublicThread,
	ChannelType.PrivateThread,
	ChannelType.AnnouncementThread
]);

function publishTicketTyping(ticketId: number, userId: string) {
	const snapshot = MemberSnapshotService.findLatestForUser(userId);
	RealtimeService.publish({
		type: 'typing.start',
		ticketId,
		userId,
		username: snapshot?.username ?? null,
		globalName: snapshot?.globalName ?? null,
		avatar: snapshot?.avatar ?? null
	});
}

function publishFromGatewayPacket(userId: string, channelId: string, guildId?: string) {
	if (!guildId) {
		const thread = TicketService.findOpenThreadForUser(userId);
		if (thread) publishTicketTyping(thread.id, userId);
		return;
	}

	const thread = TicketService.findOpenByStaffChannelId(channelId);
	if (thread) publishTicketTyping(thread.id, userId);
}

@ApplyOptions<Listener.Options>({
	name: 'typingStart',
	event: Events.Raw
})
export class TypingEvent extends Listener {
	public override async run(packet: {
		t?: string;
		d?: { user_id?: string; channel_id?: string; guild_id?: string };
	}) {
		if (packet.t !== 'TYPING_START') return;

		const userId = packet.d?.user_id;
		const channelId = packet.d?.channel_id;
		if (!userId || !channelId) return;
		if (userId === this.container.client.user?.id) return;

		publishFromGatewayPacket(userId, channelId, packet.d?.guild_id);

		const channel = await this.container.client.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased()) return;

		if (channel.type === ChannelType.DM) {
			await this.relayMemberTypingToStaffChannel(userId);
			return;
		}

		if (!STAFF_CHANNEL_TYPES.has(channel.type)) return;

		const guildId = packet.d?.guild_id ?? ('guild' in channel ? channel.guild?.id : undefined);
		await this.relayStaffTypingToMember(channelId, userId, guildId);
	}

	private async relayMemberTypingToStaffChannel(userId: string) {
		const thread = TicketService.findOpenThreadForUser(userId);
		if (!thread?.channelId) return;

		const staffChannel = await this.container.client.channels.fetch(thread.channelId).catch(() => null);
		if (!staffChannel?.isTextBased() || !('sendTyping' in staffChannel)) return;

		await staffChannel.sendTyping();
	}

	private async relayStaffTypingToMember(staffChannelId: string, userId: string, guildId?: string) {
		if (!SettingsService.getAppSettings().relayStaffTypingToMember) return;

		const thread = TicketService.findOpenByStaffChannelId(staffChannelId);
		if (!thread) return;

		const shouldRelay = await shouldRelayStaffTicketActivity(userId, thread.userId, guildId);
		if (!shouldRelay) return;

		const participants = TicketService.listUserParticipants(thread.id);
		for (const participant of participants) {
			const dmChannel = await TicketChannelService.resolveParticipantDmChannel(participant, thread.id);
			if (!dmChannel?.isDMBased() || !('sendTyping' in dmChannel)) continue;
			await dmChannel.sendTyping().catch(() => null);
		}
	}
}
