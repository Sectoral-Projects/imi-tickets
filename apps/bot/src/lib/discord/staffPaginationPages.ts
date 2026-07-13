import { paginatedTextComponent } from '@/lib/discord/staffPagination';
import { pageLines } from '@/lib/discord/staffCommand';
import { BlockService } from '@/services/block';
import { MessageTemplateService } from '@/services/messageTemplate';
import { RbacPermission, RbacService } from '@/services/rbac';
import { SettingsService } from '@/services/settings';
import { TicketService } from '@/services/ticket';
import { ticketAppUrl } from '@/lib/discord/userDisplay';
import type { StaffPageKind } from '@/lib/discord/staffPagination';

const COMMANDS = [
	['contact', 'Create a shared ticket with one or more mentioned members.'],
	['add', 'Add a member to the current ticket.'],
	['remove', 'Remove a member from the current ticket.'],
	['logs', 'Show previous tickets for a member.'],
	['block', 'Block a user or role from tickets and bot commands.'],
	['blocked', 'Show blocked users and roles.'],
	['unblock', 'Remove a user or role block.'],
	['close', 'Close the ticket, optionally after a time (e.g. close 24h).'],
	['snippets', 'List custom message templates with staff commands.'],
	['autoclose', 'Toggle inactivity auto-close for this ticket (on/off).'],
	['about', 'Show bot information.'],
	['help', 'Show this command list.']
] as const;

export function renderStaffPage(kind: StaffPageKind, page: number, context?: string) {
	switch (kind) {
		case 'logs': {
			if (!context) return paginatedTextComponent('Ticket logs', ['Missing member context.'], { kind, page, totalPages: 1 });
			const { tickets } = TicketService.listTickets({ userId: context, limit: 50 });
			const { lines, totalPages } = pageLines(
				tickets,
				(ticket) => {
					const opened = ticket.createdAt.toLocaleDateString();
					const closed = ticket.closedAt ? `, closed ${ticket.closedAt.toLocaleDateString()}` : '';
					return `• [#${ticket.id}](${ticketAppUrl(ticket.id)}) — ${ticket.status}, opened ${opened}${closed}`;
				},
				page,
				10
			);
			return paginatedTextComponent(`Ticket logs for ${context}`, lines, { kind, page, totalPages, context });
		}
		case 'blocked': {
			const { entries } = BlockService.list({ limit: 50 });
			const { lines, totalPages } = pageLines(
				entries,
				(entry) => `• **${entry.entityType}** ${entry.entityId}${entry.reason ? ` — ${entry.reason}` : ''}`,
				page,
				10
			);
			return paginatedTextComponent('Blocked users and roles', lines, { kind, page, totalPages });
		}
		case 'snippets': {
			const prefix = SettingsService.getCommandPrefix();
			const snippets = MessageTemplateService.list()
				.filter((template) => template.kind === 'custom' && template.enabled && template.staffCommand)
				.sort((a, b) => (a.staffCommand ?? '').localeCompare(b.staffCommand ?? ''));
			const { lines, totalPages } = pageLines(
				snippets,
				(template) => `• **${prefix}${template.staffCommand}** — ${template.name}`,
				page,
				10
			);
			return paginatedTextComponent(
				'Snippets',
				lines.length ? lines : ['No enabled custom snippets with a staff command.'],
				{ kind, page, totalPages: Math.max(1, totalPages) }
			);
		}
		case 'help': {
			const { lines, totalPages } = pageLines(
				COMMANDS,
				([name, description]) => `• **${name}** — ${description}`,
				page,
				10
			);
			return paginatedTextComponent('Staff commands', lines, { kind, page, totalPages });
		}
	}
}

export async function canUseStaffPagination(userId: string, guildId: string | null) {
	if (!guildId) return false;
	return RbacService.hasGuildPermission(userId, guildId, RbacPermission.Manage);
}
