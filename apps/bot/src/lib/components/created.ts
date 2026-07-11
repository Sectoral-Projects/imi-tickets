import { Component } from "./util/component";
import { APIMessageTopLevelComponent, Colors, ComponentType } from "discord.js";
import { renderTimestamp } from "./util/templateVariables";

type CreatedComponentVars = {
	timestamp?: string;
};

export class CreatedComponent extends Component<CreatedComponentVars> {
	public readonly id = "created";

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "# Ticket Created"
				},
				{
					type: ComponentType.TextDisplay,
					content: "Staff will get back to you as soon as possible."
				},
				{
					type: ComponentType.TextDisplay,
					content: "-# Your message has been sent • {{{timestamp}}}"
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: CreatedComponentVars = {}) {
		return super.render({ timestamp: vars.timestamp ?? renderTimestamp() });
	}
}

export const Created = new CreatedComponent();
