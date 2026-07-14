import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type MemberDmsClosedComponentVars = {
	/** Discord mention, e.g. `<@123>`. */
	userMention: string;
};

export class MemberDmsClosedComponent extends Component<MemberDmsClosedComponentVars> {
	public readonly id = 'member-dms-closed';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Orange,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '{{{userMention}}} — DMs unavailable'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const MemberDmsClosed = new MemberDmsClosedComponent();
