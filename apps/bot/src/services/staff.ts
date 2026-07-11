import { auditLog, memberSnapshots, messages, threads } from '@/database/sqlite/schema';
import { TRANSCRIPT_SYSTEM_AUTHOR_ID } from '@/lib/transcript/systemMessage';
import { container } from '@sapphire/framework';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, like, lte, ne, not, notInArray, or } from 'drizzle-orm';
import { AuditAction } from './audit';
import { ThreadStatus } from './ticket';
import type { DbClient } from './types';

const STAFF_AUDIT_ACTIONS = [
	AuditAction.ThreadClosed,
	AuditAction.ThreadReopened,
	AuditAction.NoteCreated,
	AuditAction.ThreadTagAdded,
	AuditAction.ThreadTagRemoved
] as const;

const EXCLUDED_STAFF_USER_IDS = ['system', 'user', TRANSCRIPT_SYSTEM_AUTHOR_ID] as const;

export type StaffActionFilter = 'all' | 'messages' | 'closes' | 'notes';

export interface ListStaffInput {
	search?: string;
	action?: StaffActionFilter;
	/** Defaults to 30 when no custom range is set. */
	days?: number;
	/** Inclusive range start (`YYYY-MM-DD`). */
	from?: string;
	/** Inclusive range end (`YYYY-MM-DD`). Defaults to today. */
	to?: string;
	staffUserId?: string;
}

export type StaffMemberSummary = {
	userId: string;
	displayName: string;
	username: string | null;
	globalName: string | null;
	avatar: string | null;
	ticketsHandled: number;
	messagesSent: number;
	ticketsClosed: number;
	ticketsReopened: number;
	notesCreated: number;
	lastActiveAt: string | null;
};

export type StaffActivityPoint = {
	date: string;
	messages: number;
	actions: number;
};

export type StaffStatsTopMember = {
	userId: string;
	displayName: string;
	avatar: string | null;
	ticketsHandled: number;
};

export type StaffStats = {
	totalTickets: number;
	ticketsInProgress: number;
	topStaff: StaffStatsTopMember[];
};

export interface ListStaffResult {
	staff: StaffMemberSummary[];
	timeline: StaffActivityPoint[];
	stats: StaffStats;
}

export abstract class StaffService {
	static listAnalytics(input: ListStaffInput = {}, db: DbClient = container.sqlite): ListStaffResult {
		const { since, until } = resolveAnalyticsRange(input);
		const action = input.action ?? 'all';

		const staffMessageRowsRaw = db
			.select({
				authorId: messages.authorId,
				threadId: messages.threadId,
				createdAt: messages.createdAt
			})
			.from(messages)
			.innerJoin(threads, eq(messages.threadId, threads.id))
			.where(
				and(
					isStaffChannelMessage(),
					isNull(messages.deletedAt),
					notInArray(messages.authorId, [...EXCLUDED_STAFF_USER_IDS]),
					not(like(messages.authorId, '%:%')),
					gte(messages.createdAt, since),
					lte(messages.createdAt, until)
				)
			)
			.all();

		const staffAuditRowsRaw = db
			.select({
				executedBy: auditLog.executedBy,
				threadId: auditLog.threadId,
				action: auditLog.action,
				createdAt: auditLog.createdAt
			})
			.from(auditLog)
			.where(
				and(
					isNotNull(auditLog.threadId),
					notInArray(auditLog.executedBy, [...EXCLUDED_STAFF_USER_IDS]),
					not(like(auditLog.executedBy, '%:%')),
					inArray(auditLog.action, [...STAFF_AUDIT_ACTIONS]),
					gte(auditLog.createdAt, since),
					lte(auditLog.createdAt, until)
				)
			)
			.all();

		const staffMessageRows = staffMessageRowsRaw.filter((row) => isIdentifiableStaffUserId(row.authorId));
		const staffAuditRows = staffAuditRowsRaw.filter((row) => isIdentifiableStaffUserId(row.executedBy));

		const staffIds = new Set<string>();
		for (const row of staffMessageRows) staffIds.add(row.authorId);
		for (const row of staffAuditRows) staffIds.add(row.executedBy);

		const snapshotsRaw =
			staffIds.size > 0
				? db
						.select()
						.from(memberSnapshots)
						.where(inArray(memberSnapshots.userId, [...staffIds]))
						.orderBy(desc(memberSnapshots.capturedAt))
						.all()
				: [];

		const snapshotByUser = new Map<string, (typeof snapshotsRaw)[number]>();
		for (const snap of snapshotsRaw) {
			if (!snapshotByUser.has(snap.userId)) snapshotByUser.set(snap.userId, snap);
		}

		const summaries = new Map<string, StaffMemberSummary>();

		const ensureSummary = (userId: string) => {
			let summary = summaries.get(userId);
			if (summary) return summary;

			const snap = snapshotByUser.get(userId);
			summary = {
				userId,
				displayName: snap?.nickname ?? snap?.globalName ?? snap?.username ?? userId,
				username: snap?.username ?? null,
				globalName: snap?.globalName ?? null,
				avatar: snap?.avatar ?? null,
				ticketsHandled: 0,
				messagesSent: 0,
				ticketsClosed: 0,
				ticketsReopened: 0,
				notesCreated: 0,
				lastActiveAt: null
			};
			summaries.set(userId, summary);
			return summary;
		};

		const threadSets = new Map<string, Set<number>>();

		const touchThread = (userId: string, threadId: number) => {
			const set = threadSets.get(userId) ?? new Set<number>();
			set.add(threadId);
			threadSets.set(userId, set);
		};

		const touchActive = (userId: string, at: Date) => {
			const summary = ensureSummary(userId);
			const iso = at.toISOString();
			if (!summary.lastActiveAt || iso > summary.lastActiveAt) summary.lastActiveAt = iso;
		};

		if (action === 'all' || action === 'messages') {
			for (const row of staffMessageRows) {
				const summary = ensureSummary(row.authorId);
				summary.messagesSent += 1;
				touchThread(row.authorId, row.threadId);
				touchActive(row.authorId, row.createdAt);
			}
		}

		for (const row of staffAuditRows) {
			if (!row.threadId) continue;
			if (action === 'messages') continue;

			const includeAction =
				action === 'all' ||
				(action === 'closes' &&
					(row.action === AuditAction.ThreadClosed || row.action === AuditAction.ThreadReopened)) ||
				(action === 'notes' && row.action === AuditAction.NoteCreated);

			if (!includeAction) continue;

			const summary = ensureSummary(row.executedBy);
			touchThread(row.executedBy, row.threadId);
			touchActive(row.executedBy, row.createdAt);

			if (row.action === AuditAction.ThreadClosed) summary.ticketsClosed += 1;
			if (row.action === AuditAction.ThreadReopened) summary.ticketsReopened += 1;
			if (row.action === AuditAction.NoteCreated) summary.notesCreated += 1;
		}

		for (const [userId, set] of threadSets) {
			ensureSummary(userId).ticketsHandled = set.size;
		}

		const totalTickets = new Set([...threadSets.values()].flatMap((set) => [...set])).size;

		const inProgressRow = db
			.select({ value: count() })
			.from(threads)
			.where(and(eq(threads.status, ThreadStatus.Open), isNull(threads.deletedAt)))
			.get();
		const ticketsInProgress = inProgressRow?.value ?? 0;

		const topStaff = [...summaries.values()]
			.filter((member) => isIdentifiableStaffUserId(member.userId))
			.sort(
				(a, b) =>
					b.ticketsHandled - a.ticketsHandled ||
					b.messagesSent - a.messagesSent ||
					(b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
			)
			.slice(0, 3)
			.map((member) => ({
				userId: member.userId,
				displayName: member.displayName,
				avatar: member.avatar,
				ticketsHandled: member.ticketsHandled
			}));

		let staff = [...summaries.values()].filter((member) => isIdentifiableStaffUserId(member.userId));

		if (input.search?.trim()) {
			const q = input.search.trim().toLowerCase();
			staff = staff.filter(
				(member) =>
					member.userId.includes(q) ||
					member.displayName.toLowerCase().includes(q) ||
					member.username?.toLowerCase().includes(q) ||
					member.globalName?.toLowerCase().includes(q)
			);
		}

		staff.sort((a, b) => {
			const aTime = a.lastActiveAt ?? '';
			const bTime = b.lastActiveAt ?? '';
			return bTime.localeCompare(aTime);
		});

		const timeline = this.buildTimeline(
			staffMessageRows,
			staffAuditRows,
			since,
			until,
			input.staffUserId,
			action
		);

		return {
			staff,
			timeline,
			stats: { totalTickets, ticketsInProgress, topStaff }
		};
	}

	private static buildTimeline(
		staffMessageRows: { authorId: string; createdAt: Date }[],
		staffAuditRows: { executedBy: string; action: string; createdAt: Date }[],
		since: Date,
		until: Date,
		staffUserId: string | undefined,
		action: StaffActionFilter
	): StaffActivityPoint[] {
		const buckets = new Map<string, StaffActivityPoint>();

		const dayKey = (date: Date) => date.toISOString().slice(0, 10);

		const ensureDay = (key: string) => {
			let bucket = buckets.get(key);
			if (!bucket) {
				bucket = { date: key, messages: 0, actions: 0 };
				buckets.set(key, bucket);
			}
			return bucket;
		};

		const msPerDay = 24 * 60 * 60 * 1000;
		const start = startOfDay(since);
		const end = startOfDay(until);
		const dayCount = Math.max(0, Math.round((end.getTime() - start.getTime()) / msPerDay));

		for (let i = 0; i <= dayCount; i++) {
			const d = new Date(start.getTime() + i * msPerDay);
			ensureDay(dayKey(d));
		}

		if (action === 'all' || action === 'messages') {
			for (const row of staffMessageRows) {
				if (staffUserId && row.authorId !== staffUserId) continue;
				ensureDay(dayKey(row.createdAt)).messages += 1;
			}
		}

		if (action === 'all' || action === 'closes' || action === 'notes') {
			for (const row of staffAuditRows) {
				if (staffUserId && row.executedBy !== staffUserId) continue;
				const include =
					action === 'all' ||
					(action === 'closes' &&
						(row.action === AuditAction.ThreadClosed || row.action === AuditAction.ThreadReopened)) ||
					(action === 'notes' && row.action === AuditAction.NoteCreated);
				if (!include) continue;
				ensureDay(dayKey(row.createdAt)).actions += 1;
			}
		}

		return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
	}
}

/** Staff analytics only counts real Discord users — not synthetic transcript authors or placeholders. */
function isIdentifiableStaffUserId(userId: string) {
	if (!userId.trim()) return false;
	if ((EXCLUDED_STAFF_USER_IDS as readonly string[]).includes(userId)) return false;
	if (userId.includes(':')) return false;
	return /^\d+$/.test(userId);
}

/** Staff-side ticket messages — same rule as the timeline DM/Staff badge. */
function isStaffChannelMessage() {
	return or(
		and(isNotNull(threads.dmChannelId), ne(messages.channelId, threads.dmChannelId)),
		and(isNotNull(threads.channelId), eq(messages.channelId, threads.channelId))
	);
}

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateParam(value: string) {
	if (!DATE_PARAM_RE.test(value)) return false;
	return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function parseDateParam(value: string) {
	return new Date(`${value}T00:00:00`);
}

function startOfDay(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

function endOfDay(date: Date) {
	const next = new Date(date);
	next.setHours(23, 59, 59, 999);
	return next;
}

function resolveAnalyticsRange(input: ListStaffInput): { since: Date; until: Date } {
	const until = input.to && isDateParam(input.to) ? endOfDay(parseDateParam(input.to)) : endOfDay(new Date());

	if (input.from && isDateParam(input.from)) {
		return { since: startOfDay(parseDateParam(input.from)), until };
	}

	const days = input.days ?? 30;
	const since = startOfDay(until);
	since.setDate(since.getDate() - (days - 1));
	return { since, until };
}
