import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type StaffTicketOpenProfileVars = {
	userMention: string;
	accountCreatedAt: string;
	joinedMainGuildAt: string;
	previousTicketCount: number;
	nickname: string;
	roles: string;
	mutualServers: string;
};

export class StaffTicketOpenProfileComponent extends Component<StaffTicketOpenProfileVars> {
	public readonly id = 'staff-ticket-open-profile';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Blue,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Ticket opened by {{userMention}}'
				},
				{
					type: ComponentType.TextDisplay,
					content:
						'**Account created:** {{{accountCreatedAt}}}\n**Joined main server:** {{{joinedMainGuildAt}}}\n**Previous tickets:** {{previousTicketCount}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '**Main server nickname:** {{nickname}}\n**Main server roles:** {{{roles}}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '**Mutual linked servers:** {{mutualServers}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const StaffTicketOpenProfile = new StaffTicketOpenProfileComponent();
