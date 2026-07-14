import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type MemberDmsOpenComponentVars = {
	/** Discord mention, e.g. `<@123>`. */
	userMention: string;
};

export class MemberDmsOpenComponent extends Component<MemberDmsOpenComponentVars> {
	public readonly id = 'member-dms-open';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '{{{userMention}}} — DMs available'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const MemberDmsOpen = new MemberDmsOpenComponent();
