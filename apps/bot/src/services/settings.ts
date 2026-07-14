import { config } from '@/database/sqlite/schema';
import {
	normalizeBotPrefix,
	normalizeWordFilterRules,
	type WordFilterRule
} from '@/lib/wordFilter/match';
import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import { RbacPermission, RbacService } from './rbac';
import type { DbClient } from './types';

export type StaffRoleAlias = {
	roleId: string;
	alias: string;
};

export type AppSettings = {
	closeAfterMinutes?: number;
	autoCloseReminderMinutes?: number;
	autoTagClosedThreads?: boolean;
	notifyOnNewThread?: boolean;
	/** Primary-guild role IDs pinged when a ticket opens. */
	notifyOnNewThreadRoleIds?: string[];
	relayStaffTypingToMember?: boolean;
	anonymousStaff?: boolean;
	/** Maps primary-guild role IDs to member-facing relay labels. */
	staffRoleAliases?: StaffRoleAlias[];
	ticketOpenButtonMode?: TicketOpenButtonMode;
	staffTicketOpenProfile?: boolean;
	forwardTemplateButtonsToStaff?: boolean;
	/** Mustache template for new ticket channel/post names. Empty uses the built-in default. */
	ticketChannelNameTemplate?: string | null;
	/** When true, ticket transcripts on the site use the Discord channel/post name as the title. */
	useChannelNameForTranscript?: boolean;
	/** Sapphire / template staff-command prefix. */
	commandPrefix?: string;
	/** Leading marker for private staff notes in ticket channels. */
	privateMessagePrefix?: string;
	/** Reject member DMs that hit these terms. */
	dmWordBlacklist?: WordFilterRule[];
	/** Bot presence from Settings → Whitelabel (re-applied on ready). */
	whitelabelPresence?: WhitelabelPresenceSettings;
};

export type WhitelabelPresenceSettings = {
	statusText: string;
	activityType: 'playing' | 'listening' | 'watching' | 'competing' | 'custom';
};

export const TicketOpenButtonMode = {
	Off: 'off',
	BeforeOpen: 'before_open'
} as const;
export type TicketOpenButtonMode = (typeof TicketOpenButtonMode)[keyof typeof TicketOpenButtonMode];

export interface SettingsView {
	settings: AppSettings;
	logChannelId: string | null;
	transcriptChannelId: string | null;
	primaryGuildId: string | null;
	channelPanel: ChannelPanelView;
	canManage: boolean;
	canAdmin: boolean;
}

export interface ChannelPanelView {
	enabled: boolean;
	channelId: string | null;
	forumThreadId: string | null;
	messageId: string | null;
	forumPostTitle: string | null;
}

export interface UpdateSettingsInput {
	settings?: Partial<AppSettings> & {
		closeAfterMinutes?: number | null;
		autoCloseReminderMinutes?: number | null;
	};
	logChannelId?: string | null;
	transcriptChannelId?: string | null;
	channelPanel?: Partial<{
		enabled: boolean;
		channelId: string | null;
		forumThreadId: string | null;
		forumPostTitle: string | null;
	}>;
}

const DEFAULT_SETTINGS: AppSettings = {
	relayStaffTypingToMember: false,
	anonymousStaff: false,
	staffRoleAliases: [],
	autoTagClosedThreads: false,
	notifyOnNewThread: false,
	notifyOnNewThreadRoleIds: [],
	ticketOpenButtonMode: TicketOpenButtonMode.Off,
	staffTicketOpenProfile: true,
	forwardTemplateButtonsToStaff: true,
	commandPrefix: ';',
	privateMessagePrefix: '`',
	dmWordBlacklist: []
};

export abstract class SettingsService {
	static get(db: DbClient = container.sqlite) {
		return db.select().from(config).limit(1).get();
	}

	static getAppSettings(db: DbClient = container.sqlite): AppSettings {
		const row = this.get(db);
		const merged = {
			...DEFAULT_SETTINGS,
			...row?.settings
		};
		return normalizeAppSettings(merged);
	}

	static getCommandPrefix(db: DbClient = container.sqlite) {
		return this.getAppSettings(db).commandPrefix ?? ';';
	}

	static getPrivateMessagePrefix(db: DbClient = container.sqlite) {
		return this.getAppSettings(db).privateMessagePrefix ?? '`';
	}

	static async getView(userId: string | null | undefined, db: DbClient = container.sqlite): Promise<SettingsView> {
		const row = this.get(db);
		const manageAccess = userId
			? await RbacService.authorizeProductAccess(userId, RbacPermission.Admin)
			: { allowed: false };
		const adminAccess = manageAccess;

		return {
			settings: this.getAppSettings(db),
			logChannelId: row?.logChannelId ?? null,
			transcriptChannelId: row?.transcriptChannelId ?? null,
			primaryGuildId: row?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID ?? null,
			channelPanel: {
				enabled: row?.channelPanelEnabled ?? false,
				channelId: row?.channelPanelChannelId ?? null,
				forumThreadId: row?.channelPanelForumThreadId ?? null,
				messageId: row?.channelPanelMessageId ?? null,
				forumPostTitle: row?.channelPanelForumPostTitle ?? null
			},
			canManage: manageAccess.allowed,
			canAdmin: adminAccess.allowed
		};
	}

	static update(userId: string, input: UpdateSettingsInput, db: DbClient = container.sqlite) {
		const now = new Date();

		return db.transaction((tx) => {
			const current = tx.select().from(config).limit(1).get();
			if (!current) {
				throw new Error('Configuration has not been initialized');
			}

			const nextSettings: AppSettings = normalizeAppSettings({
				...DEFAULT_SETTINGS,
				...current.settings
			});

			if (input.settings) {
				applySettingsPatch(nextSettings, input.settings);
			}

			assertDistinctPrefixes(nextSettings);

			const values = {
				settings: nextSettings,
				logChannelId:
					input.logChannelId === undefined ? current.logChannelId : normalizeChannelId(input.logChannelId),
				transcriptChannelId:
					input.transcriptChannelId === undefined
						? current.transcriptChannelId
						: normalizeChannelId(input.transcriptChannelId),
				channelPanelEnabled:
					input.channelPanel?.enabled === undefined
						? current.channelPanelEnabled
						: input.channelPanel.enabled,
				channelPanelChannelId:
					input.channelPanel?.channelId === undefined
						? current.channelPanelChannelId
						: normalizeChannelId(input.channelPanel.channelId),
				channelPanelForumThreadId:
					input.channelPanel?.forumThreadId === undefined
						? current.channelPanelForumThreadId
						: normalizeChannelId(input.channelPanel.forumThreadId),
				channelPanelForumPostTitle:
					input.channelPanel?.forumPostTitle === undefined
						? current.channelPanelForumPostTitle
						: normalizeForumPostTitle(input.channelPanel.forumPostTitle),
				updatedAt: now
			};

			tx.update(config).set(values).where(eq(config.id, current.id)).run();

			AuditService.log(
				{
					action: AuditAction.ConfigUpdated,
					executedBy: userId,
					payload: {
						action: 'settings.updated',
						settings: nextSettings,
						logChannelId: values.logChannelId,
						transcriptChannelId: values.transcriptChannelId,
						channelPanel: {
							enabled: values.channelPanelEnabled,
							channelId: values.channelPanelChannelId,
							forumThreadId: values.channelPanelForumThreadId,
							forumPostTitle: values.channelPanelForumPostTitle
						}
					}
				},
				tx
			);

			return {
				settings: nextSettings,
				logChannelId: values.logChannelId,
				transcriptChannelId: values.transcriptChannelId,
				channelPanel: {
					enabled: values.channelPanelEnabled ?? false,
					channelId: values.channelPanelChannelId ?? null,
					forumThreadId: values.channelPanelForumThreadId ?? null,
					messageId: current.channelPanelMessageId ?? null,
					forumPostTitle: values.channelPanelForumPostTitle ?? null
				}
			};
		});
	}
}

function normalizeChannelId(value: string | null | undefined) {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeForumPostTitle(value: string | null | undefined) {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 100) : null;
}

function assertDistinctPrefixes(settings: AppSettings) {
	const command = settings.commandPrefix ?? ';';
	const privatePrefix = settings.privateMessagePrefix ?? '`';
	if (command === privatePrefix) {
		throw new Error('commandPrefix and privateMessagePrefix must be different');
	}
}

function applySettingsPatch(
	target: AppSettings,
	patch: NonNullable<UpdateSettingsInput['settings']>
) {
	if ('closeAfterMinutes' in patch) {
		const value = patch.closeAfterMinutes;
		if (value === null || value === undefined) {
			delete target.closeAfterMinutes;
			delete target.autoCloseReminderMinutes;
		} else if (!Number.isFinite(value) || value <= 0) {
			throw new Error('closeAfterMinutes must be a positive number');
		} else {
			target.closeAfterMinutes = value;
		}
	}

	if ('autoCloseReminderMinutes' in patch) {
		const value = patch.autoCloseReminderMinutes;
		if (value === null || value === undefined) {
			delete target.autoCloseReminderMinutes;
		} else if (!Number.isFinite(value) || value <= 0) {
			throw new Error('autoCloseReminderMinutes must be a positive number');
		} else if (!target.closeAfterMinutes) {
			throw new Error('autoCloseReminderMinutes requires closeAfterMinutes');
		} else if (value >= target.closeAfterMinutes) {
			throw new Error('autoCloseReminderMinutes must be less than closeAfterMinutes');
		} else {
			target.autoCloseReminderMinutes = value;
		}
	}

	if ('autoTagClosedThreads' in patch && patch.autoTagClosedThreads !== undefined) {
		target.autoTagClosedThreads = patch.autoTagClosedThreads;
	}

	if ('notifyOnNewThread' in patch && patch.notifyOnNewThread !== undefined) {
		target.notifyOnNewThread = patch.notifyOnNewThread;
	}

	if ('notifyOnNewThreadRoleIds' in patch && patch.notifyOnNewThreadRoleIds !== undefined) {
		target.notifyOnNewThreadRoleIds = normalizeNotifyRoleIds(patch.notifyOnNewThreadRoleIds);
	}

	if ('relayStaffTypingToMember' in patch && patch.relayStaffTypingToMember !== undefined) {
		target.relayStaffTypingToMember = patch.relayStaffTypingToMember;
	}

	if ('anonymousStaff' in patch && patch.anonymousStaff !== undefined) {
		target.anonymousStaff = patch.anonymousStaff;
	}

	if ('staffRoleAliases' in patch && patch.staffRoleAliases !== undefined) {
		target.staffRoleAliases = normalizeStaffRoleAliases(patch.staffRoleAliases);
	}

	if ('ticketOpenButtonMode' in patch && patch.ticketOpenButtonMode !== undefined) {
		if (!Object.values(TicketOpenButtonMode).includes(patch.ticketOpenButtonMode)) {
			throw new Error('ticketOpenButtonMode must be off or before_open');
		}
		target.ticketOpenButtonMode = patch.ticketOpenButtonMode;
	}

	if ('staffTicketOpenProfile' in patch && patch.staffTicketOpenProfile !== undefined) {
		target.staffTicketOpenProfile = patch.staffTicketOpenProfile;
	}

	if ('forwardTemplateButtonsToStaff' in patch && patch.forwardTemplateButtonsToStaff !== undefined) {
		target.forwardTemplateButtonsToStaff = patch.forwardTemplateButtonsToStaff;
	}

	if ('ticketChannelNameTemplate' in patch) {
		const value = patch.ticketChannelNameTemplate;
		if (value === null || value === undefined || value.trim() === '') {
			delete target.ticketChannelNameTemplate;
		} else {
			target.ticketChannelNameTemplate = value.trim().slice(0, 100);
		}
	}

	if ('useChannelNameForTranscript' in patch && patch.useChannelNameForTranscript !== undefined) {
		target.useChannelNameForTranscript = patch.useChannelNameForTranscript;
	}

	if ('commandPrefix' in patch && patch.commandPrefix !== undefined) {
		target.commandPrefix = normalizeBotPrefix(patch.commandPrefix, 'commandPrefix');
	}

	if ('privateMessagePrefix' in patch && patch.privateMessagePrefix !== undefined) {
		target.privateMessagePrefix = normalizeBotPrefix(patch.privateMessagePrefix, 'privateMessagePrefix');
	}

	if ('dmWordBlacklist' in patch && patch.dmWordBlacklist !== undefined) {
		target.dmWordBlacklist = normalizeWordFilterRules(patch.dmWordBlacklist);
	}

	if ('whitelabelPresence' in patch && patch.whitelabelPresence !== undefined) {
		target.whitelabelPresence = normalizeWhitelabelPresence(patch.whitelabelPresence);
	}
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
	const normalized = { ...settings };

	if (normalized.ticketOpenButtonMode === ('after_created' as string)) {
		normalized.ticketOpenButtonMode = TicketOpenButtonMode.Off;
	}

	normalized.staffRoleAliases = normalizeStaffRoleAliases(normalized.staffRoleAliases ?? []);
	normalized.notifyOnNewThreadRoleIds = normalizeNotifyRoleIds(normalized.notifyOnNewThreadRoleIds ?? []);
	// Presence filter temporarily removed (no Presence Intent); drop any stored value.
	delete (normalized as { notifyOnNewThreadPresence?: unknown }).notifyOnNewThreadPresence;
	normalized.commandPrefix = normalizeBotPrefix(normalized.commandPrefix ?? ';', 'commandPrefix');
	normalized.privateMessagePrefix = normalizeBotPrefix(
		normalized.privateMessagePrefix ?? '`',
		'privateMessagePrefix'
	);
	normalized.dmWordBlacklist = normalizeWordFilterRules(normalized.dmWordBlacklist ?? []);
	if (normalized.whitelabelPresence) {
		normalized.whitelabelPresence = normalizeWhitelabelPresence(normalized.whitelabelPresence);
	}
	if ((normalized.commandPrefix ?? ';') === (normalized.privateMessagePrefix ?? '`')) {
		normalized.privateMessagePrefix = normalized.commandPrefix === '`' ? ';' : '`';
	}

	if (normalized.ticketChannelNameTemplate !== undefined) {
		const trimmed = normalized.ticketChannelNameTemplate?.trim();
		if (!trimmed) {
			delete normalized.ticketChannelNameTemplate;
		} else {
			normalized.ticketChannelNameTemplate = trimmed.slice(0, 100);
		}
	}

	return normalized;
}

function normalizeStaffRoleAliases(value: unknown): StaffRoleAlias[] {
	if (!Array.isArray(value)) return [];

	const seen = new Set<string>();
	const aliases: StaffRoleAlias[] = [];

	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;

		const roleId = String((entry as StaffRoleAlias).roleId ?? '').trim();
		const alias = String((entry as StaffRoleAlias).alias ?? '').trim();
		if (!roleId || !alias) continue;

		if (alias.length > 64) {
			throw new Error('Staff role aliases must be 64 characters or fewer');
		}

		if (seen.has(roleId)) {
			throw new Error('Each role can only have one alias');
		}

		seen.add(roleId);
		aliases.push({ roleId, alias });
	}

	return aliases;
}

function normalizeNotifyRoleIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const entry of value) {
		const roleId = String(entry ?? '').trim();
		if (!roleId || seen.has(roleId)) continue;
		seen.add(roleId);
		ids.push(roleId);
	}
	return ids;
}

const WHITELABEL_ACTIVITY_TYPES = new Set([
	'playing',
	'listening',
	'watching',
	'competing',
	'custom'
]);

function normalizeWhitelabelPresence(value: unknown): WhitelabelPresenceSettings {
	const entry = value && typeof value === 'object' ? (value as Partial<WhitelabelPresenceSettings>) : {};
	const activityType =
		typeof entry.activityType === 'string' && WHITELABEL_ACTIVITY_TYPES.has(entry.activityType)
			? entry.activityType
			: 'watching';
	const statusText = String(entry.statusText ?? 'for tickets')
		.trim()
		.slice(0, 128);
	return {
		statusText: statusText || 'for tickets',
		activityType
	};
}
