import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type TranscriptComponentVars = {
	userLine: string;
	ticketId: string;
	ticketUrl: string;
};

export class TranscriptComponent extends Component<TranscriptComponentVars> {
	public readonly id = 'transcript';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Blue,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# {{userLine}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: 'Ticket #{{ticketId}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '[View ticket]({{{ticketUrl}}})'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const Transcript = new TranscriptComponent();
