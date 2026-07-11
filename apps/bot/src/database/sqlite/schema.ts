import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from "drizzle-orm/sqlite-core";
import type { ButtonActionConfig, ModalConfig } from "@/lib/buttonActions/types";

export const config = sqliteTable("config", {
	id: integer("id").primaryKey().default(1),
	primaryGuildId: text("primary_guild_id"),
	logChannelId: text("log_channel_id"),
	transcriptChannelId: text("transcript_channel_id"),
	channelPanelEnabled: integer("channel_panel_enabled", { mode: "boolean" }).notNull().default(false),
	channelPanelChannelId: text("channel_panel_channel_id"),
	channelPanelForumThreadId: text("channel_panel_forum_thread_id"),
	channelPanelMessageId: text("channel_panel_message_id"),
	channelPanelForumPostTitle: text("channel_panel_forum_post_title"),
	setupOwnerUserId: text("setup_owner_user_id"),
	onboardingCompletedAt: integer("onboarding_completed_at", { mode: "timestamp" }),
	settings: text("settings", { mode: "json" }).$type<{
		autoTagClosedThreads?: boolean;
		notifyOnNewThread?: boolean;
		/** When true, staff typing in a ticket channel triggers sendTyping() in the member DM. */
		relayStaffTypingToMember?: boolean;
		/** When true, staff relay messages to members omit the staff username. */
		anonymousStaff?: boolean;
		/** Primary-guild role IDs mapped to member-facing relay labels. */
		staffRoleAliases?: Array<{ roleId: string; alias: string }>;
		/** Minutes of inactivity after the last message before a ticket auto-closes. */
		closeAfterMinutes?: number;
		/** Minutes before auto-close to send a reminder DM. Requires closeAfterMinutes. */
		autoCloseReminderMinutes?: number;
		/** Controls whether tickets open immediately or wait for a ticket-open-prompt button. */
		ticketOpenButtonMode?: "off" | "before_open";
		/** When true, linked template responses from button clicks are forwarded to the staff channel. */
		forwardTemplateButtonsToStaff?: boolean;
		/** Mustache template for new ticket channel/post names. */
		ticketChannelNameTemplate?: string | null;
		/** When true, the staff site shows the Discord channel/post name as the ticket title. */
		useChannelNameForTranscript?: boolean;
	}>(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
});

export const linkedGuilds = sqliteTable("linked_guilds", {
	guildId: text("guild_id").primaryKey(),
	name: text("name"),
	isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
	channelStrategy: text("channel_strategy"),
	categoryChannelId: text("category_channel_id"),
	forumChannelId: text("forum_channel_id"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
});

export const guildStaffRolePermissions = sqliteTable(
	"guild_staff_role_permissions",
	{
		guildId: text("guild_id").notNull(),
		roleId: text("role_id").notNull(),
		permissions: text("permissions", { mode: "json" }).$type<string[]>().notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
	},
	(table) => [
		primaryKey({
			columns: [table.guildId, table.roleId]
		}),
		index("guild_staff_role_permissions_guild_id_idx").on(table.guildId)
	]
);

export const messageTemplates = sqliteTable(
	"message_templates",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		template: text("template").notNull(),
		category: text("category"),
		buttonActions: text("button_actions", { mode: "json" }).$type<Record<string, ButtonActionConfig>>(),
		staffCommand: text("staff_command"),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		version: integer("version").notNull().default(1),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
	},
	(table) => [uniqueIndex("message_templates_staff_command_unique").on(table.staffCommand)]
);

export const dmOpenButtons = sqliteTable(
	"dm_open_buttons",
	{
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		templateId: text("template_id").notNull(),
		actionType: text("action_type").notNull().default("message"),
		modalTemplateId: text("modal_template_id"),
		modalConfig: text("modal_config", { mode: "json" }).$type<ModalConfig>(),
		optionalTag: text("optional_tag"),
		sortOrder: integer("sort_order").notNull().default(0),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
	},
	(table) => [
		index("dm_open_buttons_template_id_idx").on(table.templateId),
		index("dm_open_buttons_sort_order_idx").on(table.sortOrder)
	]
);

export const channelOpenButtons = sqliteTable(
	"channel_open_buttons",
	{
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		templateId: text("template_id").notNull(),
		actionType: text("action_type").notNull().default("message"),
		modalTemplateId: text("modal_template_id"),
		modalConfig: text("modal_config", { mode: "json" }).$type<ModalConfig>(),
		optionalTag: text("optional_tag"),
		subjectTemplate: text("subject_template"),
		sortOrder: integer("sort_order").notNull().default(0),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
	},
	(table) => [
		index("channel_open_buttons_template_id_idx").on(table.templateId),
		index("channel_open_buttons_sort_order_idx").on(table.sortOrder)
	]
);

export const blockedEntities = sqliteTable(
	"blocked_entities",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		blockedBy: text("blocked_by").notNull(),
		reason: text("reason"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull()
	},
	(table) => [
		uniqueIndex("blocked_entities_entity_unique").on(table.entityType, table.entityId),
		index("blocked_entities_entity_idx").on(table.entityType, table.entityId),
		check("blocked_entities_type_check", sql`entity_type IN ('user', 'role')`)
	]
);

export const pendingTicketOpens = sqliteTable("pending_ticket_opens", {
	userId: text("user_id").primaryKey(),
	dmChannelId: text("dm_channel_id").notNull(),
	firstMessageId: text("first_message_id").notNull(),
	firstMessageContent: text("first_message_content").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export const messages = sqliteTable("messages", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	threadId: integer("thread_id").notNull(),
	channelId: text("channel_id").notNull(),
	authorId: text("author_id").notNull(),
	messageId: text("message_id").notNull(),
	/** Discord id of the bot's relay message in the opposite channel. */
	relayMessageId: text("relay_message_id"),
	memberSnapshotId: integer("member_snapshot_id"),
	content: text("content").notNull(),
	isForwarded: integer("is_forwarded", { mode: "boolean" }).notNull().default(false),
	/** Staff channel note prefixed with ` — not relayed to the member. */
	isPrivateStaff: integer("is_private_staff", { mode: "boolean" }).notNull().default(false),
	/** Logical parent message when this message is a Discord reply (not a forward). */
	replyToMessageId: integer("reply_to_message_id"),
	revision: integer("revision").notNull().default(1),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }),
	deletedAt: integer("deleted_at", { mode: "timestamp" })
});

export const messageRevisions = sqliteTable(
	"message_revisions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		messageId: integer("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		revision: integer("revision").notNull(),
		content: text("content").notNull(),
		editedAt: integer("edited_at", { mode: "timestamp" }).notNull()
	},
	(table) => [
		uniqueIndex("message_revisions_message_id_revision_idx").on(table.messageId, table.revision)
	]
);

export const messageReactions = sqliteTable(
	"message_reactions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		messageId: integer("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		emojiName: text("emoji_name").notNull(),
		emojiId: text("emoji_id"),
		emojiKey: text("emoji_key").notNull(),
		isAnimated: integer("is_animated", { mode: "boolean" }).notNull().default(false),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull()
	},
	(table) => [
		uniqueIndex("message_reactions_message_user_emoji_idx").on(table.messageId, table.userId, table.emojiKey)
	]
);

export const threads = sqliteTable("threads", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id").notNull(),
	status: text("status").notNull().default("open"),
	/** Staff-facing guild text channel or forum post thread. */
	channelId: text("channel_id"),
	/** Member DM channel used for two-way relay. */
	dmChannelId: text("dm_channel_id"),
	/** When true, member-to-member DM relays omit other participants' usernames. */
	hideMemberIdentities: integer("hide_member_identities", { mode: "boolean" })
		.notNull()
		.default(false),
	subject: text("subject"),
	/** Random token generated at ticket creation for {{random}} in channel name templates. */
	channelNameRandom: text("channel_name_random"),
	/** Current Discord channel or forum post name — updated on provision and rename. */
	staffChannelName: text("staff_channel_name"),
	lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
	/** Last message timestamp the auto-close reminder was sent for. */
	autoCloseReminderForLastMessageAt: integer("auto_close_reminder_for_last_message_at", {
		mode: "timestamp"
	}),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
	closedAt: integer("closed_at", { mode: "timestamp" }),
	deletedAt: integer("deleted_at", { mode: "timestamp" })
});

export const threadParticipants = sqliteTable(
	"thread_participants",
	{
		threadId: integer("thread_id").notNull(),
		userId: text("user_id").notNull(),
		role: text("role").notNull(),
		dmChannelId: text("dm_channel_id"),
		memberAlias: integer("member_alias"),
		joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
		lastReadAt: integer("last_read_at", { mode: "timestamp" }),
		deletedAt: integer("deleted_at", { mode: "timestamp" })
	},
	(table) => [
		primaryKey({
			columns: [table.threadId, table.userId, table.role]
		}),
		index("thread_participants_user_id_idx").on(table.userId)
	]
);

export const messageRelays = sqliteTable(
	"message_relays",
	{
		messageId: integer("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		targetChannelId: text("target_channel_id").notNull(),
		relayMessageId: text("relay_message_id").notNull(),
		recipientUserId: text("recipient_user_id")
	},
	(table) => [
		primaryKey({
			columns: [table.messageId, table.targetChannelId]
		})
	]
);

export const memberSnapshots = sqliteTable("member_snapshots", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id").notNull(),
	username: text("username"),
	globalName: text("global_name"),
	avatar: text("avatar"),
	roleIds: text("role_ids", { mode: "json" }).$type<string[]>(),
	highestRoleId: text("highest_role_id"),
	nickname: text("nickname"),
	capturedAt: integer("captured_at", { mode: "timestamp" }).notNull()
});

export const notes = sqliteTable("notes", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	threadId: integer("thread_id").notNull(),
	authorId: text("author_id").notNull(),
	content: text("content").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	deletedAt: integer("deleted_at", { mode: "timestamp" })
});

export const attachments = sqliteTable(
	"attachments",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		messageId: integer("message_id"),
		noteId: integer("note_id"),
		url: text("url").notNull(),
		name: text("name"),
		isSpoiler: integer("is_spoiler", { mode: "boolean" }).notNull().default(false),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp" })
	},
	() => [
		check(
			"attachments_parent_check",
			sql`
				(message_id IS NOT NULL AND note_id IS NULL)
				OR
				(message_id IS NULL AND note_id IS NOT NULL)
			`
		)
	]
);

/* =========================
   THREAD TAGS
========================= */

export const threadTags = sqliteTable(
	"thread_tags",
	{
		threadId: integer("thread_id").notNull(),
		tag: text("tag").notNull()
	},
	(table) => [
		primaryKey({
			columns: [table.threadId, table.tag]
		})
	]
);

/* =========================
   THREAD STATUS HISTORY
========================= */

export const threadStatusHistory = sqliteTable("thread_status_history", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	threadId: integer("thread_id").notNull(),
	status: text("status").notNull(),
	changedBy: text("changed_by").notNull(),
	reason: text("reason"),
	changedAt: integer("changed_at", { mode: "timestamp" }).notNull()
});

/* =========================
   AUDIT LOG (FULL COVERAGE)
========================= */

export const auditLog = sqliteTable("audit_log", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	action: text("action").notNull(),

	/**
	 * Core context
	 */
	threadId: integer("thread_id"),
	messageId: text("message_id"),
	noteId: integer("note_id"),
	userId: text("user_id"),

	/**
	 * Who performed the action (staff/system/user)
	 */
	executedBy: text("executed_by").notNull(),

	/**
	 * Discord channel context (if relevant)
	 */
	channelId: text("channel_id"),

	/**
	 * Optional full event payload
	 * (for maximum extensibility)
	 */
	payload: text("payload", { mode: "json" }),

	/**
	 * Examples of actions:
	 *
	 * thread.created
	 * thread.closed
	 * thread.reopened
	 * thread.tag.added
	 * thread.tag.removed
	 *
	 * message.created
	 * message.updated
	 * message.deleted
	 *
	 * note.created
	 * note.deleted
	 *
	 * attachment.created
	 * attachment.deleted
	 *
	 * member.snapshot.created
	 *
	 * config.updated
	 */
	createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

