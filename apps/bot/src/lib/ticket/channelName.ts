import { ChannelStrategy, type ChannelStrategyType } from '@/services/setup';
import Mustache from 'mustache';
import { randomBytes } from 'node:crypto';
import type { User } from 'discord.js';

Mustache.escape = (value) => String(value ?? '');

export function generateChannelNameRandom() {
	return randomBytes(4).toString('hex');
}

export function usernameSlug(user: Pick<User, 'username' | 'id'>) {
	const slug = user.username
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80);

	return slug || user.id.slice(-6);
}

export type TicketChannelNameVars = {
	ticketId?: number;
	username: string;
	usernameSlug: string;
	random: string;
};

export function renderTicketChannelName(
	template: string | null | undefined,
	vars: TicketChannelNameVars,
	strategy: ChannelStrategyType
) {
	const defaultTemplate =
		strategy === ChannelStrategy.Forum ? '#{{ticketId}} - {{username}}' : '{{ticketId}}-{{usernameSlug}}';
	const source = template?.trim() || defaultTemplate;
	const rendered = Mustache.render(source, {
		ticketId: vars.ticketId ?? '',
		username: vars.username,
		usernameSlug: vars.usernameSlug,
		random: vars.random
	}).trim();

	return sanitizeTicketChannelName(rendered, strategy);
}

export function sanitizeTicketChannelName(name: string, strategy: ChannelStrategyType) {
	const trimmed = name.trim();
	if (!trimmed) return strategy === ChannelStrategy.Forum ? 'Ticket' : 'ticket';

	if (strategy === ChannelStrategy.Forum) {
		return trimmed.slice(0, 100);
	}

	const slug = trimmed
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 100);

	return slug || 'ticket';
}
