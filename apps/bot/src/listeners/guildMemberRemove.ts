import { formatUserIdentityLine } from '@/lib/discord/userDisplay';
import { MemberLeftGuild } from '@/lib/components/memberLeftGuild';
import { linkedGuilds } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import type { GuildMember } from 'discord.js';
import { DiscordChannelService } from '@/services/discordChannel';
import { TicketService } from '@/services/ticket';

@ApplyOptions<Listener.Options>({
	name: 'guildMemberRemove',
	event: Events.GuildMemberRemove
})
export class GuildMemberRemoveEvent extends Listener {
	public override async run(member: GuildMember) {
		const linkedGuild = container.sqlite
			.select()
			.from(linkedGuilds)
			.where(eq(linkedGuilds.guildId, member.guild.id))
			.get();
		if (!linkedGuild) return;

		const thread = TicketService.findOpenThreadForUser(member.id);
		if (!thread?.channelId || member.id !== thread.userId) return;

		const components = await MemberLeftGuild.render({
			userLine: formatUserIdentityLine(member.user, member.nickname),
			guildName: linkedGuild.name ?? member.guild.name
		});

		await DiscordChannelService.sendComponents(thread.channelId, components);
	}
}
