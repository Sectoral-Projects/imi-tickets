import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';
import { renderTimestamp } from './util/templateVariables';

type ChannelTicketPanelAckVars = {
	title?: string;
	body?: string;
	timestamp?: string;
};

export class ChannelTicketPanelAckComponent extends Component<ChannelTicketPanelAckVars> {
	public readonly id = 'channel-ticket-panel-ack';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# {{{title}}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '{{{body}}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '-# {{{timestamp}}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: ChannelTicketPanelAckVars = {}) {
		return super.render({
			title: vars.title ?? 'Ticket opened',
			body: vars.body ?? 'Check your DMs to continue the conversation with staff.',
			timestamp: vars.timestamp ?? renderTimestamp()
		});
	}
}

export const ChannelTicketPanelAck = new ChannelTicketPanelAckComponent();
