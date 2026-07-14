import { GuildMembershipNoticeService } from '@/services/guildMembershipNotice';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { GuildMember, PartialGuildMember } from 'discord.js';

@ApplyOptions<Listener.Options>({
	name: 'guildMemberRemove',
	event: Events.GuildMemberRemove
})
export class GuildMemberRemoveEvent extends Listener {
	public override async run(member: GuildMember | PartialGuildMember) {
		await GuildMembershipNoticeService.notifyFromMember('leave', member);
	}
}
