import { Component } from "./util/component";
import { APIMessageTopLevelComponent, Colors, ComponentType, time } from "discord.js";

export type ScheduledCloseNoticeVars = {
	closesAt: Date;
	reason?: string;
};

export class ScheduledCloseNoticeComponent extends Component<{
	whenRelative: string;
	whenAbsolute: string;
	reasonBlock: string;
}> {
	public readonly id = "scheduled-close-notice";

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Yellow,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "# Ticket scheduled to close"
				},
				{
					type: ComponentType.TextDisplay,
					content: "This ticket will close {{{whenRelative}}} ({{{whenAbsolute}}})."
				},
				{
					type: ComponentType.TextDisplay,
					content: "{{reasonBlock}}"
				},
				{
					type: ComponentType.TextDisplay,
					content: "-# Send a message to cancel the scheduled close."
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public async renderNotice(vars: ScheduledCloseNoticeVars) {
		const reason = vars.reason?.trim() ?? "";
		const components = await super.render({
			whenRelative: time(vars.closesAt, "R"),
			whenAbsolute: time(vars.closesAt, "f"),
			reasonBlock: reason ? `**Reason:** ${reason}` : ""
		});

		if (reason) return components;

		return stripEmptyTextDisplays(components);
	}

	/** Replaces a pending schedule notice after a message cancels the close. */
	public async renderCancelled(vars: ScheduledCloseNoticeVars = { closesAt: new Date() }) {
		const reason = vars.reason?.trim() ?? "";
		const components = await super.render({
			whenRelative: time(vars.closesAt, "R"),
			whenAbsolute: time(vars.closesAt, "f"),
			reasonBlock: reason ? `**Reason:** ${reason}` : ""
		});

		return stripEmptyTextDisplays(
			components.map((component) => {
				if (component.type !== ComponentType.Container || !("components" in component)) {
					return component;
				}

				return {
					...component,
					accent_color: Colors.Grey,
					components: component.components.map((entry) => {
						if (entry.type !== ComponentType.TextDisplay || !("content" in entry)) {
							return entry;
						}

						if (entry.content.startsWith("# ")) {
							return { ...entry, content: "# Scheduled close cancelled" };
						}

						if (entry.content.startsWith("This ticket will close")) {
							return {
								...entry,
								content:
									"The scheduled close was cancelled because someone sent a message."
							};
						}

						if (entry.content.startsWith("-# ")) {
							return {
								...entry,
								content: "-# The ticket remains open."
							};
						}

						return entry;
					})
				};
			})
		);
	}
}

function stripEmptyTextDisplays(components: APIMessageTopLevelComponent[]) {
	return components.map((component) => {
		if (component.type !== ComponentType.Container || !("components" in component)) {
			return component;
		}

		return {
			...component,
			components: component.components.filter((entry) => {
				return !(
					entry.type === ComponentType.TextDisplay &&
					"content" in entry &&
					typeof entry.content === "string" &&
					entry.content.length === 0
				);
			})
		};
	});
}

export const ScheduledCloseNotice = new ScheduledCloseNoticeComponent();
