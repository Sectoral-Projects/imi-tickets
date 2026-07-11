import { Component } from "./util/component";
import { APIMessageTopLevelComponent, Colors, ComponentType } from "discord.js";

export class AutoCloseReminderComponent extends Component<{ minutes: number }> {
	public readonly id = "auto-close-reminder";

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Yellow,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "# Ticket closing soon"
				},
				{
					type: ComponentType.TextDisplay,
					content:
						"This ticket will automatically close in **{{minutes}} minutes** if there are no new messages."
				},
				{
					type: ComponentType.TextDisplay,
					content: "-# Send a message to keep this ticket open."
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const AutoCloseReminder = new AutoCloseReminderComponent();
