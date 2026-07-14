import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type MemberJoinedGuildComponentVars = {
	userLine: string;
	guildName: string;
};

export class MemberJoinedGuildComponent extends Component<MemberJoinedGuildComponentVars> {
	public readonly id = 'member-joined-guild';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Member joined server'
				},
				{
					type: ComponentType.TextDisplay,
					content: '{{userLine}} joined **{{guildName}}**.'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const MemberJoinedGuild = new MemberJoinedGuildComponent();
