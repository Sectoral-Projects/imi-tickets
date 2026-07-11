import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';
import { renderTimestamp } from './util/templateVariables';

type TicketOpenPromptComponentVars = {
	timestamp?: string;
};

export class TicketOpenPromptComponent extends Component<TicketOpenPromptComponentVars> {
	public readonly id = 'ticket-open-prompt';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Blue,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# What can we help with?'
				},
				{
					type: ComponentType.TextDisplay,
					content: 'Choose the option that best matches your request to open a ticket.'
				},
				{
					type: ComponentType.TextDisplay,
					content: '-# {{{timestamp}}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: TicketOpenPromptComponentVars = {}) {
		return super.render({ timestamp: vars.timestamp ?? renderTimestamp() });
	}
}

export const TicketOpenPrompt = new TicketOpenPromptComponent();
