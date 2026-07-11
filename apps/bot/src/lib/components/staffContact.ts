import { Component } from './util/component';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';
import { renderTimestamp } from './util/templateVariables';

export const STAFF_CONTACT_NOTICE =
	'Staff opened this ticket to contact you and will get back to you as soon as possible.';

type StaffContactComponentVars = {
	timestamp?: string;
};

export class StaffContactComponent extends Component<StaffContactComponentVars> {
	public readonly id = 'staff-contact';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '# Staff Contact'
				},
				{
					type: ComponentType.TextDisplay,
					content: STAFF_CONTACT_NOTICE
				},
				{
					type: ComponentType.TextDisplay,
					content: '-# {{{timestamp}}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: StaffContactComponentVars = {}) {
		return super.render({ timestamp: vars.timestamp ?? renderTimestamp() });
	}
}

export const StaffContact = new StaffContactComponent();
