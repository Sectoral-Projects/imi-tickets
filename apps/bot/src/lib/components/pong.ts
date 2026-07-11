import { Component } from "./util/component";
import { APIMessageTopLevelComponent, Colors, ComponentType } from "discord.js";

export class PongComponent extends Component<{ latency: number }> {
	public readonly id = "pong";

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "# Pong!"
				},
				{
					type: ComponentType.TextDisplay,
					content: "Latency: {{latency}}ms"
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const Pong = new PongComponent();