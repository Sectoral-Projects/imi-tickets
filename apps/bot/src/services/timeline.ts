import { auditLog, messages } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
	MAX_ADJACENT_GROUP_MESSAGES,
	canGroupAdjacentMessages,
	completePageAtGroupBoundary
} from '@imi/tickets-shared';
import { AuditAction } from './audit';
import type { EnrichedMessage } from './message';
import { MessageService } from './message';
import type { DbClient } from './types';

const LIFECYCLE_AUDIT_ACTIONS = [
	AuditAction.ThreadCreated,
	AuditAction.ThreadClosed,
	AuditAction.ThreadReopened,
	AuditAction.ThreadTagAdded,
	AuditAction.ThreadTagRemoved
] as const;

export type AuditTimelineEntry = typeof auditLog.$inferSelect;

export type TimelineMessageItem = {
	kind: 'message';
	message: EnrichedMessage;
};

export type TimelineAuditItem = {
	kind: 'audit';
	audit: AuditTimelineEntry;
};

export type TimelineItem = TimelineMessageItem | TimelineAuditItem;

export interface ListTimelineInput {
	threadId: number;
	cursor?: number;
	limit?: number;
}

export interface ListTimelineResult {
	items: TimelineItem[];
	nextCursor: number | null;
}

export interface ListTimelineWindowInput {
	threadId: number;
	messageId?: number;
	cursor?: string;
	direction?: 'older' | 'newer';
	limit?: number;
	beforeLimit?: number;
	afterLimit?: number;
}

export interface ListTimelineWindowResult {
	items: TimelineItem[];
	previousCursor: string | null;
	nextCursor: string | null;
	anchorMessageId: number | null;
}

type TimelineRow = {
	kind: 'message' | 'audit';
	entity_id: number;
	created_at: number | Date;
	author_id: string | null;
	channel_id: string | null;
	is_private_staff: number | boolean | null;
	reply_to_message_id: number | null;
};

type TimelineRowOrder = 'newest-first' | 'oldest-first';

export abstract class TimelineService {
	static listTimeline(input: ListTimelineInput, db: DbClient = container.sqlite): ListTimelineResult {
		const limit = input.limit ?? 30;
		const cursor = input.cursor ?? 0;

		const rows = db.all<TimelineRow>(sql`
			SELECT *
			FROM (${timelineUnionSql(input.threadId)})
			ORDER BY created_at DESC, entity_id DESC
			LIMIT ${limit + MAX_ADJACENT_GROUP_MESSAGES + 1}
			OFFSET ${cursor}
		`);

		const page = completeMessageGroupAtPageEdge(rows, limit, 'newest-first');
		const hasMore = rows.length > page.length;
		const nextCursor = hasMore ? cursor + page.length : null;

		if (page.length === 0) {
			return { items: [], nextCursor };
		}

		const messageIds = page.filter((row) => row.kind === 'message').map((row) => row.entity_id);
		const auditIds = page.filter((row) => row.kind === 'audit').map((row) => row.entity_id);

		const messageMap = this.loadMessagesByIds(input.threadId, messageIds, db);
		const auditMap = this.loadAuditsByIds(auditIds, db);

		const items: TimelineItem[] = [];

		for (const row of page) {
			if (row.kind === 'message') {
				const message = messageMap.get(row.entity_id);
				if (message) items.push({ kind: 'message', message });
				continue;
			}

			const audit = auditMap.get(row.entity_id);
			if (audit) items.push({ kind: 'audit', audit });
		}

		return { items, nextCursor };
	}

	static listTimelineWindow(input: ListTimelineWindowInput, db: DbClient = container.sqlite): ListTimelineWindowResult {
		const limit = input.limit ?? 30;
		const cursor = input.cursor ? parseTimelineCursor(input.cursor) : null;

		if (input.direction && cursor) {
			return input.direction === 'older'
				? this.listOlderWindowPage(input.threadId, cursor, limit, db)
				: this.listNewerWindowPage(input.threadId, cursor, limit, db);
		}

		if (!input.messageId) {
			return { items: [], previousCursor: null, nextCursor: null, anchorMessageId: null };
		}

		const target = db.get<TimelineRow>(sql`
			SELECT
				'message' AS kind,
				${messages.id} AS entity_id,
				${messages.createdAt} AS created_at,
				${messages.authorId} AS author_id,
				${messages.channelId} AS channel_id,
				${messages.isPrivateStaff} AS is_private_staff,
				${messages.replyToMessageId} AS reply_to_message_id
			FROM ${messages}
			WHERE ${messages.threadId} = ${input.threadId}
				AND ${messages.id} = ${input.messageId}
				AND ${messages.deletedAt} IS NULL
			LIMIT 1
		`);

		if (!target) {
			return { items: [], previousCursor: null, nextCursor: null, anchorMessageId: null };
		}

		const beforeLimit = input.beforeLimit ?? 15;
		const afterLimit = input.afterLimit ?? 15;
		const targetCursor = toTimelineCursorParts(target);

		const olderRows = db.all<TimelineRow>(sql`
			SELECT *
			FROM (${timelineUnionSql(input.threadId)})
			WHERE created_at < ${targetCursor.createdAt}
				OR (created_at = ${targetCursor.createdAt} AND entity_id < ${targetCursor.entityId})
			ORDER BY created_at DESC, entity_id DESC
			LIMIT ${beforeLimit + MAX_ADJACENT_GROUP_MESSAGES + 1}
		`);
		const newerRows = db.all<TimelineRow>(sql`
			SELECT *
			FROM (${timelineUnionSql(input.threadId)})
			WHERE created_at > ${targetCursor.createdAt}
				OR (created_at = ${targetCursor.createdAt} AND entity_id >= ${targetCursor.entityId})
			ORDER BY created_at ASC, entity_id ASC
			LIMIT ${afterLimit + 1 + MAX_ADJACENT_GROUP_MESSAGES + 1}
		`);

		const completedOlderRows = completeMessageGroupAtPageEdge(olderRows, beforeLimit, 'newest-first');
		const completedNewerRows = completeMessageGroupAtPageEdge(newerRows, afterLimit + 1, 'oldest-first');
		const hasOlder = olderRows.length > completedOlderRows.length;
		const hasNewer = newerRows.length > completedNewerRows.length;
		const page = [
			...completedOlderRows.reverse(),
			...completedNewerRows
		];

		return {
			items: this.rowsToItems(input.threadId, page, db),
			previousCursor: hasOlder && page[0] ? encodeTimelineCursor(page[0]) : null,
			nextCursor: hasNewer && page.at(-1) ? encodeTimelineCursor(page.at(-1)!) : null,
			anchorMessageId: input.messageId
		};
	}

	private static listOlderWindowPage(
		threadId: number,
		cursor: TimelineCursorParts,
		limit: number,
		db: DbClient
	): ListTimelineWindowResult {
		const rows = db.all<TimelineRow>(sql`
			SELECT *
			FROM (${timelineUnionSql(threadId)})
			WHERE created_at < ${cursor.createdAt}
				OR (created_at = ${cursor.createdAt} AND entity_id < ${cursor.entityId})
			ORDER BY created_at DESC, entity_id DESC
			LIMIT ${limit + MAX_ADJACENT_GROUP_MESSAGES + 1}
		`);
		const completedPage = completeMessageGroupAtPageEdge(rows, limit, 'newest-first');
		const hasMore = rows.length > completedPage.length;
		const page = completedPage.reverse();

		return {
			items: this.rowsToItems(threadId, page, db),
			previousCursor: hasMore && page[0] ? encodeTimelineCursor(page[0]) : null,
			nextCursor: null,
			anchorMessageId: null
		};
	}

	private static listNewerWindowPage(
		threadId: number,
		cursor: TimelineCursorParts,
		limit: number,
		db: DbClient
	): ListTimelineWindowResult {
		const rows = db.all<TimelineRow>(sql`
			SELECT *
			FROM (${timelineUnionSql(threadId)})
			WHERE created_at > ${cursor.createdAt}
				OR (created_at = ${cursor.createdAt} AND entity_id > ${cursor.entityId})
			ORDER BY created_at ASC, entity_id ASC
			LIMIT ${limit + MAX_ADJACENT_GROUP_MESSAGES + 1}
		`);
		const page = completeMessageGroupAtPageEdge(rows, limit, 'oldest-first');
		const hasMore = rows.length > page.length;

		return {
			items: this.rowsToItems(threadId, page, db),
			previousCursor: null,
			nextCursor: hasMore && page.at(-1) ? encodeTimelineCursor(page.at(-1)!) : null,
			anchorMessageId: null
		};
	}

	private static rowsToItems(threadId: number, page: TimelineRow[], db: DbClient): TimelineItem[] {
		if (page.length === 0) return [];

		const messageIds = page.filter((row) => row.kind === 'message').map((row) => row.entity_id);
		const auditIds = page.filter((row) => row.kind === 'audit').map((row) => row.entity_id);

		const messageMap = this.loadMessagesByIds(threadId, messageIds, db);
		const auditMap = this.loadAuditsByIds(auditIds, db);
		const items: TimelineItem[] = [];

		for (const row of page) {
			if (row.kind === 'message') {
				const message = messageMap.get(row.entity_id);
				if (message) items.push({ kind: 'message', message });
				continue;
			}

			const audit = auditMap.get(row.entity_id);
			if (audit) items.push({ kind: 'audit', audit });
		}

		return items;
	}

	private static loadMessagesByIds(threadId: number, messageIds: number[], db: DbClient) {
		const map = new Map<number, EnrichedMessage>();
		if (messageIds.length === 0) return map;

		const rows = db
			.select()
			.from(messages)
			.where(and(eq(messages.threadId, threadId), inArray(messages.id, messageIds), isNull(messages.deletedAt)))
			.all();

		for (const message of MessageService.enrichMessages(rows, db)) {
			map.set(message.id, message);
		}

		return map;
	}

	private static loadAuditsByIds(auditIds: number[], db: DbClient) {
		const map = new Map<number, AuditTimelineEntry>();
		if (auditIds.length === 0) return map;

		const rows = db
			.select()
			.from(auditLog)
			.where(inArray(auditLog.id, auditIds))
			.all();

		for (const row of rows) {
			map.set(row.id, row);
		}

		return map;
	}
}

type TimelineCursorParts = {
	createdAt: number;
	entityId: number;
};

function timelineUnionSql(threadId: number) {
	return sql`
		SELECT
			'message' AS kind,
			${messages.id} AS entity_id,
			${messages.createdAt} AS created_at,
			${messages.authorId} AS author_id,
			${messages.channelId} AS channel_id,
			${messages.isPrivateStaff} AS is_private_staff,
			${messages.replyToMessageId} AS reply_to_message_id
		FROM ${messages}
		WHERE ${messages.threadId} = ${threadId}
			AND ${messages.deletedAt} IS NULL
		UNION ALL
		SELECT
			'audit' AS kind,
			${auditLog.id} AS entity_id,
			${auditLog.createdAt} AS created_at,
			NULL AS author_id,
			NULL AS channel_id,
			NULL AS is_private_staff,
			NULL AS reply_to_message_id
		FROM ${auditLog}
		WHERE ${auditLog.threadId} = ${threadId}
			AND ${auditLog.action} IN (${sql.join(
				LIFECYCLE_AUDIT_ACTIONS.map((action) => sql`${action}`),
				sql`, `
			)})
	`;
}

function completeMessageGroupAtPageEdge(
	rows: TimelineRow[],
	baseLimit: number,
	order: TimelineRowOrder
): TimelineRow[] {
	return completePageAtGroupBoundary(rows, baseLimit, (currentEdge, candidate) => {
		const older = order === 'newest-first' ? candidate : currentEdge;
		const newer = order === 'newest-first' ? currentEdge : candidate;
		return timelineRowsCanGroup(older, newer);
	});
}

function timelineRowsCanGroup(older: TimelineRow, newer: TimelineRow) {
	if (older.kind !== 'message' || newer.kind !== 'message') return false;
	return canGroupAdjacentMessages(
		{
			authorId: older.author_id,
			channelId: older.channel_id,
			createdAt: older.created_at,
			isPrivateStaff: Boolean(older.is_private_staff),
			hasReply: older.reply_to_message_id !== null
		},
		{
			authorId: newer.author_id,
			channelId: newer.channel_id,
			createdAt: newer.created_at,
			isPrivateStaff: Boolean(newer.is_private_staff),
			hasReply: newer.reply_to_message_id !== null
		}
	);
}

function encodeTimelineCursor(row: TimelineRow) {
	const cursor = toTimelineCursorParts(row);
	return `${cursor.createdAt}:${cursor.entityId}`;
}

function parseTimelineCursor(value: string): TimelineCursorParts | null {
	const [createdAtRaw, entityIdRaw] = value.split(':');
	const createdAt = Number(createdAtRaw);
	const entityId = Number(entityIdRaw);

	if (!Number.isFinite(createdAt) || !Number.isFinite(entityId)) return null;
	return { createdAt, entityId };
}

function toTimelineCursorParts(row: TimelineRow): TimelineCursorParts {
	const createdAt = row.created_at instanceof Date ? row.created_at.getTime() : Number(row.created_at);
	return {
		createdAt,
		entityId: row.entity_id
	};
}
