import { generateChannelNameRandom } from '@/lib/ticket/channelName';
import { memberSnapshots, messages, threadParticipants, threadStatusHistory, threadTags, threads } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import { and, count, desc, eq, inArray, isNull, like, ne, or } from 'drizzle-orm';
import { AuditAction, AuditService } from './audit';
import { RealtimeService } from './realtime';
import { SettingsService } from './settings';
import type { DbClient } from './types';

export const ThreadStatus = {
	Open: 'open',
	Closed: 'closed'
} as const;
export type ThreadStatusType = (typeof ThreadStatus)[keyof typeof ThreadStatus] | (string & {});

export const ParticipantRole = {
	User: 'user',
	Staff: 'staff'
} as const;
export type ParticipantRoleType = (typeof ParticipantRole)[keyof typeof ParticipantRole] | (string & {});

export const ANONYMOUS_STAFF_AUTHOR_LABEL = 'Staff';

export function formatMemberAlias(alias: number) {
	return `User #${alias}`;
}

export interface CreateThreadInput {
	userId: string;
	/** Staff-facing guild channel or forum post id â€” set after provisioning. */
	channelId?: string;
	/** Primary member DM channel id â€” kept for backward compatibility. */
	dmChannelId?: string;
	subject?: string;
	executedBy: string;
	hideMemberIdentities?: boolean;
}

export type ThreadParticipant = typeof threadParticipants.$inferSelect;

export type EnrichedParticipant = ThreadParticipant & {
	user: typeof memberSnapshots.$inferSelect | null;
};

export interface CloseThreadInput {
	threadId: number;
	executedBy: string;
	reason?: string;
}

export interface ListTicketsInput {
	/** Row offset â€” pass back `nextCursor` from the previous page. */
	cursor?: number;
	/** Defaults to 20. */
	limit?: number;
	/** Matched against `subject` with a `LIKE %search%`. */
	search?: string;
	status?: ThreadStatusType;
	userId?: string;
}

export type EnrichedTicket = typeof threads.$inferSelect & {
	latestMessage: typeof messages.$inferSelect | null;
	user: typeof memberSnapshots.$inferSelect | null;
};

export interface ListTicketsResult {
	tickets: EnrichedTicket[];
	nextCursor: number | null;
}

export abstract class TicketService {
	static findOpenThreadForUser(userId: string, db: DbClient = container.sqlite) {
		return this.listOpenThreadsForUserParticipant(userId, db)[0] ?? null;
	}

	/** All open tickets where this Discord user is an active member participant. */
	static listOpenThreadsForUserParticipant(userId: string, db: DbClient = container.sqlite) {
		const byParticipant = db
			.select({ threadId: threadParticipants.threadId })
			.from(threadParticipants)
			.innerJoin(threads, eq(threads.id, threadParticipants.threadId))
			.where(
				and(
					eq(threadParticipants.userId, userId),
					eq(threadParticipants.role, ParticipantRole.User),
					isNull(threadParticipants.deletedAt),
					eq(threads.status, ThreadStatus.Open),
					isNull(threads.deletedAt)
				)
			)
			.all()
			.map((row) => row.threadId);

		const byOwner = db
			.select({ id: threads.id })
			.from(threads)
			.where(and(eq(threads.userId, userId), eq(threads.status, ThreadStatus.Open), isNull(threads.deletedAt)))
			.all()
			.map((row) => row.id);

		const threadIds = [...new Set([...byParticipant, ...byOwner])];
		if (threadIds.length === 0) return [];

		return db
			.select()
			.from(threads)
			.where(and(inArray(threads.id, threadIds), eq(threads.status, ThreadStatus.Open), isNull(threads.deletedAt)))
			.all();
	}

	static findById(threadId: number, db: DbClient = container.sqlite) {
		return db.select().from(threads).where(eq(threads.id, threadId)).get();
	}

	static findByChannelId(channelId: string, db: DbClient = container.sqlite) {
		return db.select().from(threads).where(eq(threads.channelId, channelId)).get();
	}

	static findOpenByStaffChannelId(channelId: string, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(threads)
			.where(and(eq(threads.channelId, channelId), eq(threads.status, ThreadStatus.Open), isNull(threads.deletedAt)))
			.limit(1)
			.get();
	}

	static clearStaffChannelId(threadId: number, db: DbClient = container.sqlite) {
		return db.update(threads).set({ channelId: null }).where(eq(threads.id, threadId)).run();
	}

	static setStaffChannel(
		threadId: number,
		channelId: string,
		channelName?: string | null,
		db: DbClient = container.sqlite
	) {
		const trimmedName = channelName?.trim();
		return db
			.update(threads)
			.set({
				channelId,
				...(trimmedName ? { staffChannelName: trimmedName } : {})
			})
			.where(eq(threads.id, threadId))
			.run();
	}

	static setStaffChannelName(threadId: number, channelName: string, db: DbClient = container.sqlite) {
		return db
			.update(threads)
			.set({ staffChannelName: channelName.trim().slice(0, 100) })
			.where(eq(threads.id, threadId))
			.run();
	}

	static setDmChannelId(threadId: number, dmChannelId: string, db: DbClient = container.sqlite) {
		return db.update(threads).set({ dmChannelId }).where(eq(threads.id, threadId)).run();
	}

	static markAutoCloseReminderSent(threadId: number, lastMessageAt: Date, db: DbClient = container.sqlite) {
		return db
			.update(threads)
			.set({ autoCloseReminderForLastMessageAt: lastMessageAt })
			.where(eq(threads.id, threadId))
			.run();
	}

	static setScheduledClose(
		threadId: number,
		at: Date,
		notices: {
			closesAt: number;
			reason?: string;
			auditId?: number;
			messages: Array<{ channelId: string; messageId: string }>;
		} | null = null,
		db: DbClient = container.sqlite
	) {
		return db
			.update(threads)
			.set({
				scheduledCloseAt: at,
				scheduledCloseNotices: notices
			})
			.where(and(eq(threads.id, threadId), eq(threads.status, ThreadStatus.Open), isNull(threads.deletedAt)))
			.run();
	}

	/**
	 * Clears a pending scheduled close.
	 * Returns the stored notice payload when a schedule was present (for Discord edits).
	 */
	static clearScheduledClose(
		threadId: number,
		db: DbClient = container.sqlite
	): {
		closesAt: number;
		reason?: string;
		auditId?: number;
		messages: Array<{ channelId: string; messageId: string }>;
	} | null {
		const existing = db
			.select({
				scheduledCloseAt: threads.scheduledCloseAt,
				scheduledCloseNotices: threads.scheduledCloseNotices
			})
			.from(threads)
			.where(eq(threads.id, threadId))
			.get();
		if (!existing?.scheduledCloseAt) return null;

		const notices = existing.scheduledCloseNotices ?? {
			closesAt: existing.scheduledCloseAt.getTime(),
			messages: []
		};

		db.update(threads)
			.set({ scheduledCloseAt: null, scheduledCloseNotices: null })
			.where(eq(threads.id, threadId))
			.run();
		return notices;
	}

	static setAutoCloseDisabled(threadId: number, disabled: boolean, db: DbClient = container.sqlite) {
		return db.update(threads).set({ autoCloseDisabled: disabled }).where(eq(threads.id, threadId)).run();
	}

	/**
	 * Paginated, filterable ticket listing, enriched with each thread's
	 * latest message and the opening user's latest identity snapshot.
	 * This is the single source of truth for the tickets list endpoint â€”
	 * keep route handlers as thin wrappers around this.
	 */
	static listTickets(input: ListTicketsInput = {}, db: DbClient = container.sqlite): ListTicketsResult {
		const limit = input.limit ?? 20;
		const cursor = input.cursor ?? 0;

		const conditions = [];
		if (input.search) {
			const search = `%${input.search}%`;
			const settings = SettingsService.getAppSettings(db);
			if (settings.useChannelNameForTranscript) {
				conditions.push(or(like(threads.subject, search), like(threads.staffChannelName, search)));
			} else {
				conditions.push(like(threads.subject, search));
			}
		}
		if (input.status) conditions.push(eq(threads.status, input.status));
		if (input.userId) conditions.push(eq(threads.userId, input.userId));

		const baseQuery = db.select().from(threads).orderBy(desc(threads.id)).$dynamic();
		const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

		const rows = filteredQuery.limit(limit + 1).offset(cursor).all();
		const hasMore = rows.length > limit;
		const tickets = hasMore ? rows.slice(0, limit) : rows;
		const nextCursor = hasMore ? cursor + limit : null;

		if (tickets.length === 0) {
			return { tickets: [], nextCursor };
		}

		const threadIds = tickets.map((t) => t.id);
		const userIds = [...new Set(tickets.map((t) => t.userId))];

		// Latest message per thread (bulk fetch, first-seen-wins since ordered desc)
		const latestMessagesRaw = db.select().from(messages).where(inArray(messages.threadId, threadIds)).orderBy(desc(messages.createdAt)).all();

		const latestMessagesMap = new Map<number, (typeof latestMessagesRaw)[number]>();
		for (const msg of latestMessagesRaw) {
			if (!latestMessagesMap.has(msg.threadId)) latestMessagesMap.set(msg.threadId, msg);
		}

		// Latest identity snapshot per user (bulk fetch, same pattern)
		const snapshotsRaw = db.select().from(memberSnapshots).where(inArray(memberSnapshots.userId, userIds)).orderBy(desc(memberSnapshots.capturedAt)).all();

		const userMap = new Map<string, (typeof snapshotsRaw)[number]>();
		for (const snap of snapshotsRaw) {
			if (!userMap.has(snap.userId)) userMap.set(snap.userId, snap);
		}

		const enriched: EnrichedTicket[] = tickets.map((t) => ({
			...t,
			latestMessage: latestMessagesMap.get(t.id) ?? null,
			user: userMap.get(t.userId) ?? null
		}));

		return { tickets: enriched, nextCursor };
	}

	static countTicketsForUser(userId: string, excludeThreadId?: number, db: DbClient = container.sqlite) {
		const conditions = [eq(threads.userId, userId), isNull(threads.deletedAt)];
		if (excludeThreadId !== undefined) conditions.push(ne(threads.id, excludeThreadId));

		const row = db
			.select({ value: count() })
			.from(threads)
			.where(and(...conditions))
			.get();

		return row?.value ?? 0;
	}

	/**
	 * Creates a thread, registers the opening user as a participant, records
	 * the initial status-history entry, and writes an audit log entry â€”
	 * atomically in one transaction.
	 */
	static create(data: CreateThreadInput) {
		const thread = container.sqlite.transaction((tx) => {
			const thread = tx
				.insert(threads)
				.values({
					userId: data.userId,
					channelId: data.channelId,
					dmChannelId: data.dmChannelId,
					subject: data.subject,
					channelNameRandom: generateChannelNameRandom(),
					hideMemberIdentities: data.hideMemberIdentities ?? false,
					status: ThreadStatus.Open,
					lastMessageAt: new Date()
				})
				.returning()
				.get();

			tx.insert(threadParticipants)
				.values({
					threadId: thread.id,
					userId: data.userId,
					role: ParticipantRole.User,
					dmChannelId: data.dmChannelId,
					memberAlias: data.hideMemberIdentities ? this.pickRandomMemberAlias(thread.id, tx) : undefined,
					joinedAt: new Date()
				})
				.run();

			tx.insert(threadStatusHistory)
				.values({
					threadId: thread.id,
					status: ThreadStatus.Open,
					changedBy: data.executedBy,
					changedAt: new Date()
				})
				.run();

			AuditService.log(
				{
					action: AuditAction.ThreadCreated,
					executedBy: data.executedBy,
					threadId: thread.id,
					userId: data.userId,
					channelId: data.dmChannelId ?? data.channelId
				},
				tx
			);

			return thread;
		});

		RealtimeService.publish({ type: 'ticket.created', ticketId: thread.id });

		return thread;
	}

	static close(data: CloseThreadInput) {
		const thread = container.sqlite.transaction((tx) => {
			const now = new Date();

			const thread = tx
				.update(threads)
				.set({
					status: ThreadStatus.Closed,
					closedAt: now,
					scheduledCloseAt: null,
					scheduledCloseNotices: null
				})
				.where(eq(threads.id, data.threadId))
				.returning()
				.get();

			tx.insert(threadStatusHistory)
				.values({
					threadId: data.threadId,
					status: ThreadStatus.Closed,
					changedBy: data.executedBy,
					reason: data.reason,
					changedAt: now
				})
				.run();

			AuditService.log(
				{
					action: AuditAction.ThreadClosed,
					executedBy: data.executedBy,
					threadId: data.threadId,
					payload: data.reason ? { reason: data.reason } : undefined
				},
				tx
			);

			return thread;
		});

		RealtimeService.publish({
			type: 'ticket.updated',
			ticketId: data.threadId,
			status: ThreadStatus.Closed
		});

		return thread;
	}

	static reopen(threadId: number, executedBy: string) {
		const thread = container.sqlite.transaction((tx) => {
			const thread = tx
				.update(threads)
				.set({ status: ThreadStatus.Open, closedAt: null })
				.where(eq(threads.id, threadId))
				.returning()
				.get();

			tx.insert(threadStatusHistory)
				.values({
					threadId,
					status: ThreadStatus.Open,
					changedBy: executedBy,
					changedAt: new Date()
				})
				.run();

			AuditService.log({ action: AuditAction.ThreadReopened, executedBy, threadId }, tx);

			return thread;
		});

		RealtimeService.publish({
			type: 'ticket.updated',
			ticketId: threadId,
			status: ThreadStatus.Open
		});

		return thread;
	}

	/** Cheap, high-frequency update â€” no audit log, called on every inbound message. */
	static touchLastMessageAt(threadId: number, db: DbClient = container.sqlite) {
		return db.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, threadId)).run();
	}

	static addTag(threadId: number, tag: string, executedBy: string) {
		return container.sqlite.transaction((tx) => {
			tx.insert(threadTags).values({ threadId, tag }).onConflictDoNothing().run();
			AuditService.log({ action: AuditAction.ThreadTagAdded, executedBy, threadId, payload: { tag } }, tx);
		});
	}

	static removeTag(threadId: number, tag: string, executedBy: string) {
		return container.sqlite.transaction((tx) => {
			tx.delete(threadTags)
				.where(and(eq(threadTags.threadId, threadId), eq(threadTags.tag, tag)))
				.run();
			AuditService.log({ action: AuditAction.ThreadTagRemoved, executedBy, threadId, payload: { tag } }, tx);
		});
	}

	static listTags(threadId: number, db: DbClient = container.sqlite) {
		return db.select().from(threadTags).where(eq(threadTags.threadId, threadId)).all();
	}

	static addParticipant(
		threadId: number,
		userId: string,
		role: ParticipantRoleType,
		options: { dmChannelId?: string; executedBy?: string } = {},
		db: DbClient = container.sqlite
	) {
		const thread = db.select().from(threads).where(eq(threads.id, threadId)).get();
		const memberAlias =
			thread?.hideMemberIdentities && role === ParticipantRole.User
				? this.pickRandomMemberAlias(threadId, db)
				: undefined;

		return db
			.insert(threadParticipants)
			.values({
				threadId,
				userId,
				role,
				dmChannelId: options.dmChannelId,
				memberAlias,
				joinedAt: new Date()
			})
			.onConflictDoUpdate({
				target: [threadParticipants.threadId, threadParticipants.userId, threadParticipants.role],
				set: {
					dmChannelId: options.dmChannelId,
					deletedAt: null,
					joinedAt: new Date()
				}
			})
			.run();
	}

	static listUserParticipants(threadId: number, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(threadParticipants)
			.where(
				and(
					eq(threadParticipants.threadId, threadId),
					eq(threadParticipants.role, ParticipantRole.User),
					isNull(threadParticipants.deletedAt)
				)
			)
			.all();
	}

	static listStaffParticipants(threadId: number, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(threadParticipants)
			.where(
				and(
					eq(threadParticipants.threadId, threadId),
					eq(threadParticipants.role, ParticipantRole.Staff),
					isNull(threadParticipants.deletedAt)
				)
			)
			.all();
	}

	/**
	 * Marks a staff member as joined on this ticket. A user may also be a member
	 * participant; staff and member roles are independent rows.
	 */
	static ensureStaffParticipant(threadId: number, userId: string, db: DbClient = container.sqlite) {
		const trimmed = userId.trim();
		if (!/^\d{17,20}$/.test(trimmed)) return false;
		if (container.client.user?.id === trimmed) return false;

		const existing = db
			.select()
			.from(threadParticipants)
			.where(
				and(
					eq(threadParticipants.threadId, threadId),
					eq(threadParticipants.userId, trimmed),
					eq(threadParticipants.role, ParticipantRole.Staff)
				)
			)
			.get();

		if (existing && existing.deletedAt == null) return false;

		if (existing) {
			db.update(threadParticipants)
				.set({
					deletedAt: null,
					joinedAt: new Date()
				})
				.where(
					and(
						eq(threadParticipants.threadId, threadId),
						eq(threadParticipants.userId, trimmed),
						eq(threadParticipants.role, ParticipantRole.Staff)
					)
				)
				.run();
			return true;
		}

		db.insert(threadParticipants)
			.values({
				threadId,
				userId: trimmed,
				role: ParticipantRole.Staff,
				joinedAt: new Date()
			})
			.run();
		return true;
	}

	/** Staff who joined via channel activity, with a one-time backfill from recorded staff-channel messages. */
	static listStaffParticipantIds(threadId: number, staffChannelId: string | null | undefined, db: DbClient = container.sqlite) {
		if (staffChannelId) {
			for (const authorId of this.listStaffAuthorIdsFromMessages(threadId, staffChannelId, db)) {
				this.ensureStaffParticipant(threadId, authorId, db);
			}
		}

		return this.listStaffParticipants(threadId, db).map((participant) => participant.userId);
	}

	static listParticipants(threadId: number, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(threadParticipants)
			.where(and(eq(threadParticipants.threadId, threadId), isNull(threadParticipants.deletedAt)))
			.all();
	}

	static listEnrichedParticipants(threadId: number, db: DbClient = container.sqlite): EnrichedParticipant[] {
		const participants = this.listParticipants(threadId, db);
		if (participants.length === 0) return [];

		const userIds = [...new Set(participants.map((participant) => participant.userId))];
		const snapshotsRaw = db
			.select()
			.from(memberSnapshots)
			.where(inArray(memberSnapshots.userId, userIds))
			.orderBy(desc(memberSnapshots.capturedAt))
			.all();

		const snapshotByUser = new Map<string, (typeof snapshotsRaw)[number]>();
		for (const snap of snapshotsRaw) {
			if (!snapshotByUser.has(snap.userId)) snapshotByUser.set(snap.userId, snap);
		}

		return participants.map((participant) => ({
			...participant,
			user: snapshotByUser.get(participant.userId) ?? null
		}));
	}

	static getUserParticipant(threadId: number, userId: string, db: DbClient = container.sqlite) {
		return db
			.select()
			.from(threadParticipants)
			.where(
				and(
					eq(threadParticipants.threadId, threadId),
					eq(threadParticipants.userId, userId),
					eq(threadParticipants.role, ParticipantRole.User),
					isNull(threadParticipants.deletedAt)
				)
			)
			.get();
	}

	static setParticipantDmUnreachable(
		threadId: number,
		userId: string,
		unreachable: boolean,
		db: DbClient = container.sqlite
	) {
		return db
			.update(threadParticipants)
			.set({ dmUnreachable: unreachable })
			.where(
				and(
					eq(threadParticipants.threadId, threadId),
					eq(threadParticipants.userId, userId),
					eq(threadParticipants.role, ParticipantRole.User)
				)
			)
			.run();
	}

	static isUserParticipant(threadId: number, userId: string, db: DbClient = container.sqlite) {
		return Boolean(this.getUserParticipant(threadId, userId, db));
	}

	static pickRandomMemberAlias(threadId: number, db: DbClient = container.sqlite) {
		const used = new Set(
			db
				.select({ memberAlias: threadParticipants.memberAlias })
				.from(threadParticipants)
				.where(eq(threadParticipants.threadId, threadId))
				.all()
				.map((row) => row.memberAlias)
				.filter((alias): alias is number => alias != null)
		);

		let alias = 0;
		do {
			alias = Math.floor(Math.random() * 999) + 1;
		} while (used.has(alias));

		return alias;
	}

	static ensureMemberAlias(threadId: number, userId: string, db: DbClient = container.sqlite) {
		const participant = this.getUserParticipant(threadId, userId, db);
		if (!participant) return null;

		if (participant.memberAlias != null) {
			return participant.memberAlias;
		}

		const memberAlias = this.pickRandomMemberAlias(threadId, db);
		db.update(threadParticipants)
			.set({ memberAlias })
			.where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, userId)))
			.run();

		return memberAlias;
	}

	static memberAuthorLabel(
		thread: { id: number; hideMemberIdentities?: boolean },
		userId: string,
		fallbackTag: string,
		db: DbClient = container.sqlite
	) {
		if (!thread.hideMemberIdentities) return fallbackTag;

		const alias = this.ensureMemberAlias(thread.id, userId, db);
		return alias != null ? formatMemberAlias(alias) : fallbackTag;
	}

	static removeParticipant(threadId: number, userId: string, executedBy: string, db: DbClient = container.sqlite) {
		const participants = this.listUserParticipants(threadId, db);
		if (participants.length <= 1) {
			throw new Error('Cannot remove the last member from a ticket.');
		}

		const existing = this.getUserParticipant(threadId, userId, db);
		if (!existing) {
			throw new Error('That member is not on this ticket.');
		}

		db.update(threadParticipants)
			.set({ deletedAt: new Date() })
			.where(
				and(
					eq(threadParticipants.threadId, threadId),
					eq(threadParticipants.userId, userId),
					eq(threadParticipants.role, ParticipantRole.User)
				)
			)
			.run();

		AuditService.log({
			action: AuditAction.ParticipantRemoved,
			executedBy,
			threadId,
			userId,
			payload: { userId }
		});

		RealtimeService.publish({ type: 'ticket.updated', ticketId: threadId });
		return true;
	}

	/** Distinct human authors who posted in the staff channel (excludes system/bot rows). */
	static listStaffAuthorIdsFromMessages(threadId: number, staffChannelId: string, db: DbClient = container.sqlite) {
		const botId = container.client.user?.id;
		const rows = db
			.select({ authorId: messages.authorId })
			.from(messages)
			.where(
				and(eq(messages.threadId, threadId), eq(messages.channelId, staffChannelId), isNull(messages.deletedAt))
			)
			.all();

		const staffIds = new Set<string>();
		for (const row of rows) {
			const authorId = row.authorId;
			if (!authorId) continue;
			if (botId && authorId === botId) continue;
			if (authorId.startsWith('transcript:')) continue;
			if (!/^\d{17,20}$/.test(authorId)) continue;
			staffIds.add(authorId);
		}

		return [...staffIds];
	}

	static markRead(threadId: number, userId: string, db: DbClient = container.sqlite) {
		return db
			.update(threadParticipants)
			.set({ lastReadAt: new Date() })
			.where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, userId)))
			.run();
	}
}