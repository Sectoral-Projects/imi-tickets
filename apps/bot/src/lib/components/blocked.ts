import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export class BlockedComponent extends Component<{ reason?: string }> {
	public readonly id = 'blocked';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Red,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# You cannot open tickets'
				},
				{
					type: ComponentType.TextDisplay,
					content: 'You are currently blocked from using this bot.'
				},
				{
					type: ComponentType.TextDisplay,
					content: '**Reason:** {{reason}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: { reason?: string } = {}) {
		const components = await super.render({
			reason: vars.reason?.trim() ?? ''
		});

		if (vars.reason?.trim()) return components;

		return components.map((component) => {
			if (component.type !== ComponentType.Container || !('components' in component)) {
				return component;
			}

			return {
				...component,
				components: component.components.filter((entry) => {
					return !(
						entry.type === ComponentType.TextDisplay &&
						'content' in entry &&
						entry.content.startsWith('**Reason:**')
					);
				})
			};
		});
	}
}

export const Blocked = new BlockedComponent();
