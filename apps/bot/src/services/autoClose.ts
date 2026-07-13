import { threads } from '@/database/sqlite/schema';
import { AutoCloseReminder } from '@/lib/components/autoCloseReminder';
import { container } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { SettingsService } from './settings';
import { TicketChannelService } from './ticketChannel';
import { TicketCloseService } from './ticketClose';
import { TicketService, ThreadStatus } from './ticket';
import type { DbClient } from './types';

/** Upper bound when idle — avoids a permanent timer when no tickets exist. */
const MAX_POLL_MS = 60_000;
const MIN_POLL_MS = 1_000;

export abstract class AutoCloseService {
	private static timer: NodeJS.Timeout | null = null;

	static start() {
		void this.tick().finally(() => this.schedule());
	}

	/** Reschedule the next DB-driven wake — call after messages or settings changes. */
	static wake() {
		this.schedule();
	}

	private static schedule(db: DbClient = container.sqlite) {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		const delayMs = this.getNextDelayMs(db);
		if (delayMs === null) return;

		this.timer = setTimeout(() => {
			this.timer = null;
			void this.tick().finally(() => this.schedule());
		}, delayMs);

		this.timer.unref();
	}

	private static getNextDelayMs(db: DbClient): number | null {
		const settings = SettingsService.getAppSettings(db);
		const closeAfterMinutes = settings.closeAfterMinutes;
		const now = Date.now();
		let nextAt: number | null = null;

		const scheduledRow = db.get<{ at: number | null }>(sql`
			SELECT MIN(CAST(strftime('%s', ${threads.scheduledCloseAt}) AS INTEGER) * 1000) AS at
			FROM ${threads}
			WHERE ${threads.status} = ${ThreadStatus.Open}
				AND ${threads.deletedAt} IS NULL
				AND ${threads.scheduledCloseAt} IS NOT NULL
		`);
		if (scheduledRow?.at) nextAt = scheduledRow.at;

		if (closeAfterMinutes && closeAfterMinutes > 0) {
			const closeAfterMs = closeAfterMinutes * 60_000;

			const closeRow = db.get<{ at: number | null }>(sql`
				SELECT MIN(CAST(strftime('%s', ${threads.lastMessageAt}) AS INTEGER) * 1000 + ${closeAfterMs}) AS at
				FROM ${threads}
				WHERE ${threads.status} = ${ThreadStatus.Open}
					AND ${threads.deletedAt} IS NULL
					AND ${threads.lastMessageAt} IS NOT NULL
					AND ${threads.autoCloseDisabled} = 0
			`);

			if (closeRow?.at) {
				nextAt = nextAt ? Math.min(nextAt, closeRow.at) : closeRow.at;
			}

			const reminderMinutes = settings.autoCloseReminderMinutes;
			if (reminderMinutes && reminderMinutes > 0 && reminderMinutes < closeAfterMinutes) {
				const remindLeadMs = closeAfterMs - reminderMinutes * 60_000;
				const remindRow = db.get<{ at: number | null }>(sql`
					SELECT MIN(CAST(strftime('%s', ${threads.lastMessageAt}) AS INTEGER) * 1000 + ${remindLeadMs}) AS at
					FROM ${threads}
					WHERE ${threads.status} = ${ThreadStatus.Open}
						AND ${threads.deletedAt} IS NULL
						AND ${threads.lastMessageAt} IS NOT NULL
						AND ${threads.autoCloseDisabled} = 0
						AND (
							${threads.autoCloseReminderForLastMessageAt} IS NULL
							OR ${threads.autoCloseReminderForLastMessageAt} != ${threads.lastMessageAt}
						)
				`);

				if (remindRow?.at) {
					nextAt = nextAt ? Math.min(nextAt, remindRow.at) : remindRow.at;
				}
			}
		}

		if (!nextAt) {
			return closeAfterMinutes && closeAfterMinutes > 0 ? MAX_POLL_MS : null;
		}

		const delay = nextAt - now;
		if (delay <= 0) return 0;

		return Math.max(MIN_POLL_MS, Math.min(delay, MAX_POLL_MS));
	}

	static async tick(db: DbClient = container.sqlite) {
		await this.processDueScheduledCloses(db);

		const settings = SettingsService.getAppSettings(db);
		const closeAfterMinutes = settings.closeAfterMinutes;
		if (!closeAfterMinutes || closeAfterMinutes <= 0) return;

		await this.processDueCloses(db, closeAfterMinutes);
		await this.processDueReminders(db, settings);
	}

	private static async processDueScheduledCloses(db: DbClient) {
		const now = new Date();
		const due = db
			.select({ id: threads.id })
			.from(threads)
			.where(
				and(
					eq(threads.status, ThreadStatus.Open),
					isNull(threads.deletedAt),
					isNotNull(threads.scheduledCloseAt),
					lte(threads.scheduledCloseAt, now)
				)
			)
			.all();

		for (const row of due) {
			await TicketCloseService.close({
				threadId: row.id,
				executedBy: 'system',
				reason: 'Scheduled close'
			});
		}
	}

	private static async processDueCloses(db: DbClient, closeAfterMinutes: number) {
		const closeAfterMs = closeAfterMinutes * 60_000;
		const closeCutoff = new Date(Date.now() - closeAfterMs);

		const due = db
			.select({ id: threads.id })
			.from(threads)
			.where(
				and(
					eq(threads.status, ThreadStatus.Open),
					isNull(threads.deletedAt),
					eq(threads.autoCloseDisabled, false),
					isNotNull(threads.lastMessageAt),
					lte(threads.lastMessageAt, closeCutoff)
				)
			)
			.all();

		for (const row of due) {
			await TicketCloseService.close({
				threadId: row.id,
				executedBy: 'system',
				reason: 'Auto-closed due to inactivity'
			});
		}
	}

	private static async processDueReminders(
		db: DbClient,
		settings: ReturnType<typeof SettingsService.getAppSettings>
	) {
		const closeAfterMinutes = settings.closeAfterMinutes;
		const reminderMinutes = settings.autoCloseReminderMinutes;
		if (!closeAfterMinutes || !reminderMinutes || reminderMinutes <= 0 || reminderMinutes >= closeAfterMinutes) {
			return;
		}

		const now = Date.now();
		const closeAfterMs = closeAfterMinutes * 60_000;
		const remindLeadMs = closeAfterMs - reminderMinutes * 60_000;
		const remindCutoff = new Date(now - remindLeadMs);
		const closeCutoff = new Date(now - closeAfterMs);

		const due = db
			.select()
			.from(threads)
			.where(
				and(
					eq(threads.status, ThreadStatus.Open),
					isNull(threads.deletedAt),
					eq(threads.autoCloseDisabled, false),
					isNotNull(threads.lastMessageAt),
					lte(threads.lastMessageAt, remindCutoff),
					gt(threads.lastMessageAt, closeCutoff),
					or(
						isNull(threads.autoCloseReminderForLastMessageAt),
						sql`${threads.autoCloseReminderForLastMessageAt} != ${threads.lastMessageAt}`
					)
				)
			)
			.all();

		for (const thread of due) {
			if (!thread.lastMessageAt) continue;
			await this.sendReminder(thread, reminderMinutes, db);
		}
	}

	private static async sendReminder(
		thread: typeof threads.$inferSelect,
		minutes: number,
		db: DbClient
	) {
		if (!thread.lastMessageAt) return;

		const components = await AutoCloseReminder.render({ minutes });
		const participants = TicketService.listUserParticipants(thread.id, db);

		for (const participant of participants) {
			const dmChannel = await TicketChannelService.resolveParticipantDmChannel(participant, thread.id, db);
			if (!dmChannel?.isDMBased()) continue;

			await dmChannel.send({
				components,
				flags: MessageFlags.IsComponentsV2
			});
		}

		TicketService.markAutoCloseReminderSent(thread.id, thread.lastMessageAt, db);
	}
}
