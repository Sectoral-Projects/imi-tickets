import { GuildMembershipNoticeService } from '@/services/guildMembershipNotice';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';

@ApplyOptions<Listener.Options>({
	name: 'guildMemberAdd',
	event: Events.GuildMemberAdd
})
export class GuildMemberAddEvent extends Listener {
	public override async run(member: GuildMember) {
		await GuildMembershipNoticeService.notifyFromMember('join', member);
	}
}
