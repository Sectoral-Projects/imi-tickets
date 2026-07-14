import { componentsToTranscriptText } from '@/lib/components/util/transcriptText';
import { formatUserIdentityLine } from '@/lib/discord/userDisplay';
import { MemberJoinedGuild } from '@/lib/components/memberJoinedGuild';
import { MemberLeftGuild } from '@/lib/components/memberLeftGuild';
import { TRANSCRIPT_SYSTEM_AUTHOR_ID } from '@/lib/transcript/systemMessage';
import { DiscordChannelService } from '@/services/discordChannel';
import { MessageService } from '@/services/message';
import { TicketService } from '@/services/ticket';
import { container } from '@sapphire/framework';
import type { Guild, GuildMember, PartialGuildMember, User } from 'discord.js';

export type GuildMembershipChangeKind = 'join' | 'leave';

/**
 * Posts a staff-only Components V2 notice in every open ticket where the user
 * is an active member participant, for any guild the bot is in.
 */
export abstract class GuildMembershipNoticeService {
	static async notify(input: {
		kind: GuildMembershipChangeKind;
		user: User;
		guild: Guild;
		nickname?: string | null;
	}) {
		const threads = TicketService.listOpenThreadsForUserParticipant(input.user.id).filter(
			(thread) => Boolean(thread.channelId)
		);
		if (threads.length === 0) return;

		const userLine = formatUserIdentityLine(input.user, input.nickname);
		const guildName = input.guild.name;
		const components =
			input.kind === 'join'
				? await MemberJoinedGuild.render({ userLine, guildName })
				: await MemberLeftGuild.render({ userLine, guildName });
		const transcriptContent = componentsToTranscriptText(components);

		for (const thread of threads) {
			if (!thread.channelId) continue;

			const sent = await DiscordChannelService.sendComponents(thread.channelId, components).catch(
				(error) => {
					container.logger.warn(
						`Failed to post guild-${input.kind} notice for ticket ${thread.id}`,
						error
					);
					return null;
				}
			);
			if (!sent) continue;

			MessageService.create({
				threadId: thread.id,
				channelId: thread.channelId,
				authorId: TRANSCRIPT_SYSTEM_AUTHOR_ID,
				messageId: sent.id,
				content: transcriptContent || `${userLine} ${input.kind === 'join' ? 'joined' : 'left'} ${guildName}`,
				isPrivateStaff: true,
				executedBy: TRANSCRIPT_SYSTEM_AUTHOR_ID
			});
		}
	}

	static async notifyFromMember(
		kind: GuildMembershipChangeKind,
		member: GuildMember | PartialGuildMember
	) {
		const user =
			member.user ??
			(await container.client.users.fetch(member.id).catch(() => null));
		if (!user || user.bot) return;

		await this.notify({
			kind,
			user,
			guild: member.guild,
			nickname: 'nickname' in member ? member.nickname : null
		});
	}
}
