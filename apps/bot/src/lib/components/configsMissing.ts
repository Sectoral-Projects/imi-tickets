import { Component } from "./util/component";
import { APIMessageTopLevelComponent, Colors, ComponentType } from "discord.js";
import { renderTimestamp } from "./util/templateVariables";

export class FailedComponent extends Component<{ reason: string; timestamp?: string }> {
	public readonly id = "failed";

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Red,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "# Ticket could not be opened."
				},
				{
					type: ComponentType.TextDisplay,
					content: "{{reason}}"
				},
				{
					type: ComponentType.TextDisplay,
					content: "-# {{{timestamp}}}"
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: { reason: string; timestamp?: string }) {
		return super.render({
			reason: vars.reason,
			timestamp: vars.timestamp ?? renderTimestamp()
		});
	}
}

export const failed = new FailedComponent();
