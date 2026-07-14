import { RbacPermission, RbacService, type RbacPermissionType } from '@/services/rbac';
import { TicketParticipantService } from '@/services/ticketParticipant';
import { container } from '@sapphire/framework';
import {
	ComponentType,
	GuildMember,
	Message,
	MessageFlags,
	PermissionFlagsBits,
	type APIMessageTopLevelComponent
} from 'discord.js';
import type { Command } from '@sapphire/framework';
import { paginatedTextComponent, type StaffPageKind } from '@/lib/discord/staffPagination';

export type CommandTarget =
	| Message
	| Command.ChatInputCommandInteraction
	| Command.ContextMenuCommandInteraction;

const componentReplyFlags = [MessageFlags.IsComponentsV2] as const;
const ephemeralComponentReplyFlags = [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] as const;

export function formatCommandError(error: unknown, fallback = 'Something went wrong.') {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return fallback;
}

function noteStaffJoinedFromCommandTarget(target: CommandTarget) {
	const userId = 'author' in target ? target.author.id : target.user.id;
	const channelId = target.channelId ?? ('channel' in target ? target.channel?.id : null);
	TicketParticipantService.noteStaffActivityInChannel(channelId, userId);
}

export async function requireGuildPermission(target: CommandTarget, permission: RbacPermissionType = RbacPermission.Manage) {
	try {
		const guildId = target.guildId;
		const userId = 'author' in target ? target.author.id : target.user.id;
		if (!guildId) return false;

		let allowed = false;

		if ('memberPermissions' in target && target.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			allowed = await RbacService.hasGuildPermission(userId, guildId, permission, undefined, {
				administrator: true
			});
		} else if ('member' in target && target.member instanceof GuildMember) {
			allowed = await RbacService.hasGuildPermission(userId, guildId, permission, undefined, { member: target.member });
		} else if ('member' in target && target.member && 'roles' in target.member && Array.isArray(target.member.roles)) {
			allowed = await RbacService.hasGuildPermission(userId, guildId, permission, undefined, {
				roleIds: [...target.member.roles]
			});
		} else {
			allowed = await RbacService.hasGuildPermission(userId, guildId, permission);
		}

		if (allowed) {
			noteStaffJoinedFromCommandTarget(target);
		}

		return allowed;
	} catch (error) {
		container.logger.warn('Failed to resolve guild permission for staff command', error);
		return false;
	}
}

export async function replyText(target: CommandTarget, content: string) {
	try {
		if ('user' in target) {
			if (target.deferred || target.replied) {
				await target.editReply({ content });
				return;
			}

			await target.reply({ content, flags: [MessageFlags.Ephemeral] });
			return;
		}

		await target.reply({ content });
	} catch (error) {
		container.logger.error('Failed to send plain-text staff command reply', error);
	}
}

export async function replyComponents(
	target: CommandTarget,
	components: APIMessageTopLevelComponent[],
	options?: { fallback?: string }
) {
	await respondComponents(target, components, options);
}

export async function respondComponents(
	target: CommandTarget,
	components: APIMessageTopLevelComponent[],
	options?: { fallback?: string }
): Promise<Message | null> {
	try {
		if ('user' in target) {
			if (target.deferred || target.replied) {
				await target.editReply({
					components,
					flags: [...componentReplyFlags],
					allowedMentions: { parse: [] }
				});
				return null;
			}

			await target.reply({
				components,
				flags: [...ephemeralComponentReplyFlags],
				allowedMentions: { parse: [] }
			});
			return null;
		}

		return await target.reply({
			components,
			flags: [...componentReplyFlags],
			allowedMentions: { parse: [] }
		});
	} catch (error) {
		container.logger.warn('Failed to send Component V2 staff command reply', error);
		await replyText(target, options?.fallback ?? 'Command completed, but the response could not be displayed.');
		return null;
	}
}

export function textComponent(
	title: string,
	lines: string[],
	options?: {
		kind?: StaffPageKind;
		page?: number;
		totalPages?: number;
		context?: string;
	}
): APIMessageTopLevelComponent[] {
	if (options?.kind !== undefined && options.page !== undefined && options.totalPages !== undefined) {
		return paginatedTextComponent(title, lines, {
			kind: options.kind,
			page: options.page,
			totalPages: options.totalPages,
			context: options.context
		});
	}

	const containerComponents = [
		{
			type: ComponentType.Container,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: `# ${title}`
				},
				{
					type: ComponentType.TextDisplay,
					content: lines.length > 0 ? lines.join('\n') : 'No results.'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	return containerComponents;
}

export function pageLines<T>(items: readonly T[], format: (item: T, index: number) => string, page = 0, pageSize = 10) {
	const start = page * pageSize;
	const pageItems = items.slice(start, start + pageSize);
	const lines = pageItems.map((item, index) => format(item, start + index));
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	return {
		lines: [...lines, '', `-# Page ${page + 1}/${totalPages}`],
		totalPages
	};
}
