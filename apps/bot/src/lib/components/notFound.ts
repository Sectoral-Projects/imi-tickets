import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export class TicketNotFoundComponent extends Component {
	public readonly id = 'notFound';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Orange,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# No ticket found.'
				},
				{
					type: ComponentType.TextDisplay,
					content: 'You can create a new ticket by just sending a message.'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const NotFound = new TicketNotFoundComponent();
