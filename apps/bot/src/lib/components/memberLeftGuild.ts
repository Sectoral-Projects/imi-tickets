import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type MemberLeftGuildComponentVars = {
	userLine: string;
	guildName: string;
};

export class MemberLeftGuildComponent extends Component<MemberLeftGuildComponentVars> {
	public readonly id = 'member-left-guild';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Orange,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Member left server'
				},
				{
					type: ComponentType.TextDisplay,
					content: '{{userLine}} left **{{guildName}}**.'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const MemberLeftGuild = new MemberLeftGuildComponent();
