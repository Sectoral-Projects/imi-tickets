import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';

export type AuditLogComponentVars = {
	action: string;
	summary: string;
	actor: string;
	timestamp: string;
};

export class AuditLogComponent extends Component<AuditLogComponentVars> {
	public readonly id = 'audit-log';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Greyple,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# {{action}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '{{summary}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '**By:** {{actor}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '-# {{timestamp}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];
}

export const AuditLog = new AuditLogComponent();
