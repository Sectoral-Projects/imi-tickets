import { AuditLog } from './auditLog';
import { AutoCloseReminder } from './autoCloseReminder';
import { Blocked } from './blocked';
import { Closed } from './closed';
import { Created } from './created';
import { failed } from './configsMissing';
import { MemberDmsClosed } from './memberDmsClosed';
import { MemberDmsOpen } from './memberDmsOpen';
import { MemberJoinedGuild } from './memberJoinedGuild';
import { MemberLeftGuild } from './memberLeftGuild';
import { Message } from './message';
import { NotFound } from './notFound';
import { Pong } from './pong';
import { ScheduledCloseNotice } from './scheduledCloseNotice';
import { StaffTicketOpenProfile } from './staffTicketOpenProfile';
import { TicketOpenPrompt } from './ticketOpenPrompt';
import { ChannelTicketPanelAck } from './channelTicketPanelAck';
import { TicketChannelPanel } from './ticketChannelPanel';
import { Transcript } from './transcript';
import { ticketAppUrl } from '@/lib/discord/userDisplay';
import type { APIMessageTopLevelComponent } from 'discord.js';
import {
	mergeGlobalTemplateVariables,
	previewTimestamp,
	withPreviewTimestamp
} from './util/templateVariables';

export type SystemComponentDefinition = {
	id: string;
	name: string;
	description: string;
	category: string;
	variables: string[];
	sampleVariables: Record<string, unknown>;
	defaultTemplate: () => unknown;
	renderDefault: () => Promise<unknown>;
	/** Member-facing templates whose buttons can forward linked responses to staff. */
	supportsButtonForward: boolean;
};

function defineSystemComponent(
	component: {
		id: string;
		getSourceTemplate: () => APIMessageTopLevelComponent[];
	},
	meta: {
		name: string;
		description: string;
		category: string;
		variables: string[];
		sampleVariables?: Record<string, unknown>;
		renderDefault: () => Promise<unknown>;
		supportsButtonForward?: boolean;
	}
): SystemComponentDefinition {
	return {
		id: component.id,
		name: meta.name,
		description: meta.description,
		category: meta.category,
		variables: mergeGlobalTemplateVariables(meta.variables),
		sampleVariables: withPreviewTimestamp(meta.sampleVariables),
		defaultTemplate: () => component.getSourceTemplate(),
		renderDefault: meta.renderDefault,
		supportsButtonForward: meta.supportsButtonForward ?? false
	};
}

export const SYSTEM_COMPONENTS: SystemComponentDefinition[] = [
	defineSystemComponent(TicketOpenPrompt, {
		name: 'Ticket open prompt',
		description: 'Sent in before-open mode to ask the member to pick a ticket category.',
		category: 'tickets',
		variables: [],
		supportsButtonForward: true,
		renderDefault: () => TicketOpenPrompt.render()
	}),
	defineSystemComponent(TicketChannelPanel, {
		name: 'Channel ticket panel',
		description: 'Published in a guild channel or forum post so members can open tickets from a button.',
		category: 'tickets',
		variables: [],
		supportsButtonForward: true,
		renderDefault: () => TicketChannelPanel.render()
	}),
	defineSystemComponent(ChannelTicketPanelAck, {
		name: 'Channel ticket panel ack',
		description: 'Ephemeral guild confirmation after opening a ticket from a channel panel button.',
		category: 'tickets',
		variables: ['title', 'body'],
		sampleVariables: {
			title: 'Ticket opened',
			body: 'Check your DMs to continue the conversation with staff.'
		},
		renderDefault: () => ChannelTicketPanelAck.render()
	}),
	defineSystemComponent(StaffTicketOpenProfile, {
		name: 'Staff ticket open profile',
		description: 'Staff-only profile shown in the ticket channel and transcript when a member is added.',
		category: 'tickets',
		variables: [
			'heading',
			'userMention',
			'accountCreatedAt',
			'joinedMainGuildAt',
			'previousTicketCount',
			'nickname',
			'roles',
			'mutualServers'
		],
		sampleVariables: {
			heading: 'Ticket opened by <@123>',
			userMention: '<@123>',
			accountCreatedAt: '<t:0:F>',
			joinedMainGuildAt: '<t:0:F>',
			previousTicketCount: 2,
			nickname: 'Example nickname',
			roles: '<@&123>, <@&456>',
			mutualServers: 'Example Server'
		},
		renderDefault: () =>
			StaffTicketOpenProfile.render({
				heading: 'Ticket opened by <@123>',
				userMention: '<@123>',
				accountCreatedAt: '<t:0:F>',
				joinedMainGuildAt: '<t:0:F>',
				previousTicketCount: 2,
				nickname: 'Example nickname',
				roles: '<@&123>, <@&456>',
				mutualServers: 'Example Server'
			})
	}),
	defineSystemComponent(Created, {
		name: 'Ticket created',
		description: 'Sent to a member after a ticket is created.',
		category: 'tickets',
		variables: [],
		supportsButtonForward: true,
		renderDefault: () => Created.render()
	}),
	defineSystemComponent(Closed, {
		name: 'Ticket closed',
		description: 'Sent when a ticket is closed.',
		category: 'tickets',
		variables: ['reason', 'timestamp'],
		sampleVariables: { reason: 'Resolved', timestamp: previewTimestamp() },
		renderDefault: () => Closed.render({ reason: 'Resolved', timestamp: previewTimestamp() })
	}),
	defineSystemComponent(Message, {
		name: 'Relay message',
		description: 'Used for member/staff message relay.',
		category: 'tickets',
		variables: ['author', 'message', 'timestamp'],
		sampleVariables: { author: 'Staff', message: 'Hello!', timestamp: previewTimestamp() },
		renderDefault: () =>
			Message.render({ author: 'Staff', message: 'Hello!', timestamp: previewTimestamp() })
	}),
	defineSystemComponent(AutoCloseReminder, {
		name: 'Auto-close reminder',
		description: 'Sent before an inactive ticket auto-closes.',
		category: 'tickets',
		variables: ['minutes'],
		sampleVariables: { minutes: 30 },
		supportsButtonForward: true,
		renderDefault: () => AutoCloseReminder.render({ minutes: 30 })
	}),
	defineSystemComponent(ScheduledCloseNotice, {
		name: 'Scheduled close notice',
		description: 'Sent when staff schedules a ticket close with ;close /close time. Edited in place when cancelled.',
		category: 'tickets',
		variables: ['whenRelative', 'whenAbsolute', 'reasonBlock'],
		sampleVariables: {
			whenRelative: '<t:1710000000:R>',
			whenAbsolute: '<t:1710000000:f>',
			reasonBlock: '**Reason:** Resolved'
		},
		supportsButtonForward: true,
		renderDefault: () =>
			ScheduledCloseNotice.renderNotice({
				closesAt: new Date(1_710_000_000_000),
				reason: 'Resolved'
			})
	}),
	defineSystemComponent(Transcript, {
		name: 'Transcript notification',
		description: 'Posted to the transcript channel when a ticket opens.',
		category: 'logs',
		variables: ['userLine', 'ticketId', 'ticketUrl'],
		sampleVariables: {
			userLine: 'User (123)',
			ticketId: '1',
			ticketUrl: ticketAppUrl(1)
		},
		renderDefault: () =>
			Transcript.render({ userLine: 'User (123)', ticketId: '1', ticketUrl: ticketAppUrl(1) })
	}),
	defineSystemComponent(AuditLog, {
		name: 'Audit log',
		description: 'Posted to the audit log channel for staff-visible events.',
		category: 'logs',
		variables: ['action', 'summary', 'actor', 'timestamp'],
		sampleVariables: {
			action: 'thread.created',
			summary: 'Ticket opened',
			actor: 'Staff',
			timestamp: previewTimestamp()
		},
		renderDefault: () =>
			AuditLog.render({
				action: 'thread.created',
				summary: 'Ticket opened',
				actor: 'Staff',
				timestamp: previewTimestamp()
			})
	}),
	defineSystemComponent(MemberLeftGuild, {
		name: 'Member left guild',
		description:
			'Staff-only notice in open tickets when a member participant leaves any server the bot is in.',
		category: 'tickets',
		variables: ['userLine', 'guildName'],
		sampleVariables: { userLine: 'User (123)', guildName: 'Example Server' },
		renderDefault: () => MemberLeftGuild.render({ userLine: 'User (123)', guildName: 'Example Server' })
	}),
	defineSystemComponent(MemberJoinedGuild, {
		name: 'Member joined guild',
		description:
			'Staff-only notice in open tickets when a member participant joins any server the bot is in.',
		category: 'tickets',
		variables: ['userLine', 'guildName'],
		sampleVariables: { userLine: 'User (123)', guildName: 'Example Server' },
		renderDefault: () =>
			MemberJoinedGuild.render({ userLine: 'User (123)', guildName: 'Example Server' })
	}),
	defineSystemComponent(MemberDmsClosed, {
		name: 'Member DMs unavailable',
		description:
			'Staff-only notice when a ticket participant cannot receive bot DMs (closed DMs or no mutual guilds).',
		category: 'tickets',
		variables: ['userMention'],
		sampleVariables: { userMention: '<@123>' },
		renderDefault: () => MemberDmsClosed.render({ userMention: '<@123>' })
	}),
	defineSystemComponent(MemberDmsOpen, {
		name: 'Member DMs available',
		description:
			'Staff-only notice when a previously unreachable ticket participant starts accepting bot DMs again.',
		category: 'tickets',
		variables: ['userMention'],
		sampleVariables: { userMention: '<@123>' },
		renderDefault: () => MemberDmsOpen.render({ userMention: '<@123>' })
	}),
	defineSystemComponent(Blocked, {
		name: 'Blocked user',
		description: 'Sent when a blocked user tries to use the bot.',
		category: 'access',
		variables: ['reason'],
		sampleVariables: { reason: 'Reason shown here.' },
		renderDefault: () => Blocked.render({ reason: 'Reason shown here.' })
	}),
	defineSystemComponent(NotFound, {
		name: 'Ticket not found',
		description: 'Sent when a member command cannot find an open ticket.',
		category: 'commands',
		variables: [],
		renderDefault: () => NotFound.render()
	}),
	defineSystemComponent(Pong, {
		name: 'Pong',
		description: 'Ping command response.',
		category: 'commands',
		variables: ['latency'],
		sampleVariables: { latency: 42 },
		renderDefault: () => Pong.render({ latency: 42 })
	}),
	defineSystemComponent(failed, {
		name: 'Failure',
		description: 'Generic failure component.',
		category: 'system',
		variables: ['reason'],
		sampleVariables: { reason: 'Something went wrong.' },
		renderDefault: () => failed.render({ reason: 'Something went wrong.' })
	})
];

export const SYSTEM_COMPONENT_IDS = new Set(SYSTEM_COMPONENTS.map((component) => component.id));

export function findSystemComponent(id: string) {
	return SYSTEM_COMPONENTS.find((component) => component.id === id) ?? null;
}

export function systemComponentSupportsButtonForward(id: string) {
	return findSystemComponent(id)?.supportsButtonForward ?? false;
}

function toSystemTemplateView(system: SystemComponentDefinition) {
	return {
		id: system.id,
		name: system.name,
		description: system.description,
		template: system.defaultTemplate(),
		previewVariables: withPreviewTimestamp(system.sampleVariables),
		category: system.category,
		templateType: 'message' as const,
		enabled: false,
		version: 0,
		updatedAt: '',
		kind: 'system' as const,
		variables: mergeGlobalTemplateVariables(system.variables),
		staffCommand: null,
		usesCodeDefault: true,
		supportsButtonForward: system.supportsButtonForward
	};
}

export function getSystemTemplateView(id: string) {
	const system = findSystemComponent(id);
	return system ? toSystemTemplateView(system) : null;
}

export function listSystemTemplateViews() {
	return SYSTEM_COMPONENTS.map((system) => toSystemTemplateView(system));
}
