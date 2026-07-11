import type { APIRole, APIUser, Role, User } from 'discord.js';

export function formatUserIdentityLine(user: User, nickname?: string | null) {
	const name = nickname ?? user.globalName ?? user.username;
	return `${name} (${user.id})`;
}

export function formatEntityMention(entity: User | Role | APIUser | APIRole) {
	return 'bot' in entity ? `<@${entity.id}>` : `<@&${entity.id}>`;
}

export function getAppBaseUrl() {
	return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
}

export function ticketAppUrl(ticketId: number) {
	return `${getAppBaseUrl()}/${ticketId}`;
}
