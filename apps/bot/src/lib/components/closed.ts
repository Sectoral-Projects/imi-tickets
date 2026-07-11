import { Component } from "./util/component";
import { APIMessageTopLevelComponent, Colors, ComponentType, time } from "discord.js";

export type ClosedComponentVars = {
	reason?: string;
	timestamp?: string;
};

export class ClosedComponent extends Component<ClosedComponentVars> {
	public readonly id = "closed";

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "# Ticket Closed"
				},
				{
					type: ComponentType.TextDisplay,
					content: "This ticket has been closed. You can create a new ticket by just sending a message."
				},
				{
					type: ComponentType.TextDisplay,
					content: "**Reason:** {{reason}}"
				},
				{
					type: ComponentType.TextDisplay,
					content: "-# {{{timestamp}}}"
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: ClosedComponentVars = {}) {
		const components = await super.render({
			reason: vars.reason?.trim() ?? '',
			timestamp: time(new Date(), 'f')
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

export const Closed = new ClosedComponent();
