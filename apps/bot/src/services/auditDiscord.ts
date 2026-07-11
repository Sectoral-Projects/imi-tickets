import { AuditLog } from '@/lib/components/auditLog';
import { auditLog } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { AuditAction } from './audit';
import { DiscordChannelService } from './discordChannel';
import { SettingsService } from './settings';

type AuditEntry = typeof auditLog.$inferSelect;

export abstract class AuditDiscordService {
	static notify(entry: AuditEntry) {
		const logChannelId = SettingsService.get()?.logChannelId;
		if (!logChannelId) return;

		queueMicrotask(() => {
			void this.send(entry, logChannelId).catch((error) => {
				container.logger.warn('Failed to send audit log to Discord channel', error);
			});
		});
	}

	private static async send(entry: AuditEntry, logChannelId: string) {
		const { action, summary } = formatAuditEntry(entry);
		const actor = await resolveActorLabel(entry.executedBy);
		const components = await AuditLog.render({
			action,
			summary,
			actor,
			timestamp: DiscordChannelService.formatTimestamp(entry.createdAt)
		});

		await DiscordChannelService.sendComponents(logChannelId, components);
	}
}

function formatAuditEntry(entry: AuditEntry) {
	const payload = (entry.payload ?? {}) as Record<string, unknown>;

	switch (entry.action) {
		case AuditAction.ThreadCreated:
			return {
				action: 'Ticket opened',
				summary: entry.threadId ? `Ticket #${entry.threadId}` : 'New ticket'
			};
		case AuditAction.ThreadClosed: {
			const reason =
				typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : null;
			return {
				action: 'Ticket closed',
				summary: [entry.threadId ? `Ticket #${entry.threadId}` : null, reason ? `Reason: ${reason}` : null]
					.filter(Boolean)
					.join('\n')
			};
		}
		case AuditAction.ThreadReopened:
			return {
				action: 'Ticket reopened',
				summary: entry.threadId ? `Ticket #${entry.threadId}` : 'Ticket reopened'
			};
		case AuditAction.ThreadTagAdded:
			return {
				action: 'Tag added',
				summary: [
					entry.threadId ? `Ticket #${entry.threadId}` : null,
					typeof payload.tag === 'string' ? `Tag: ${payload.tag}` : null
				]
					.filter(Boolean)
					.join('\n')
			};
		case AuditAction.ThreadTagRemoved:
			return {
				action: 'Tag removed',
				summary: [
					entry.threadId ? `Ticket #${entry.threadId}` : null,
					typeof payload.tag === 'string' ? `Tag: ${payload.tag}` : null
				]
					.filter(Boolean)
					.join('\n')
			};
		case AuditAction.MessageCreated:
			return {
				action: 'Message recorded',
				summary: [
					entry.threadId ? `Ticket #${entry.threadId}` : null,
					entry.messageId ? `Message: ${entry.messageId}` : null
				]
					.filter(Boolean)
					.join('\n')
			};
		case AuditAction.MessageUpdated:
			return {
				action: 'Message updated',
				summary: entry.threadId ? `Ticket #${entry.threadId}` : 'Message updated'
			};
		case AuditAction.MessageDeleted:
			return {
				action: 'Message deleted',
				summary: entry.threadId ? `Ticket #${entry.threadId}` : 'Message deleted'
			};
		case AuditAction.NoteCreated:
			return {
				action: 'Note created',
				summary: entry.threadId ? `Ticket #${entry.threadId}` : 'Note created'
			};
		case AuditAction.NoteDeleted:
			return {
				action: 'Note deleted',
				summary: entry.threadId ? `Ticket #${entry.threadId}` : 'Note deleted'
			};
		case AuditAction.ConfigUpdated:
			return {
				action: 'Configuration updated',
				summary:
					typeof payload.action === 'string'
						? String(payload.action)
						: 'Settings or setup changed'
			};
		default:
			return {
				action: entry.action,
				summary: [
					entry.threadId ? `Ticket #${entry.threadId}` : null,
					entry.userId ? `User: ${entry.userId}` : null
				]
					.filter(Boolean)
					.join('\n') || 'Audit event'
			};
	}
}

async function resolveActorLabel(executedBy: string) {
	if (executedBy === 'system') return 'System';

	const user = await container.client.users.fetch(executedBy).catch(() => null);
	return user?.tag ?? executedBy;
}
