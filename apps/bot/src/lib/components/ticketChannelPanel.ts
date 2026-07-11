import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';
import { renderTimestamp } from './util/templateVariables';

type TicketChannelPanelComponentVars = {
	timestamp?: string;
};

export class TicketChannelPanelComponent extends Component<TicketChannelPanelComponentVars> {
	public readonly id = 'ticket-channel-panel';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Blurple,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Contact staff'
				},
				{
					type: ComponentType.TextDisplay,
					content: 'Choose an option below to open a private ticket. We will DM you to continue the conversation.'
				},
				{
					type: ComponentType.TextDisplay,
					content: '-# {{{timestamp}}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: TicketChannelPanelComponentVars = {}) {
		return super.render({ timestamp: vars.timestamp ?? renderTimestamp() });
	}
}

export const TicketChannelPanel = new TicketChannelPanelComponent();
