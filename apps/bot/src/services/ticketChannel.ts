import { Message as RelayMessage } from '@/lib/components/message';
import { extractRelayContent, type RelayContent } from '@/lib/discord/relayContent';
import { reactionEmojiMatches, type StoredReactionEmoji } from '@/lib/discord/reactionEmoji';
import { StaffTicketOpenProfile } from '@/lib/components/staffTicketOpenProfile';
import { guildStaffRolePermissions, linkedGuilds } from '@/database/sqlite/schema';
import { container } from '@sapphire/framework';
import {
	ChannelType,
	GuildMember,
	MessageFlags,
	PermissionFlagsBits,
	Role,
	time,
	type DMChannel,
	type Guild,
	type GuildBasedChannel,
	type Message,
	type MessageCreateOptions,
	type MessageReaction,
	type OverwriteResolvable,
	type User
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { SettingsService } from './settings';
import { ChannelStrategy, SetupService } from './setup';
import { MessageRelayService } from './messageRelay';
import { MessageService } from './message';
import { TicketService, ParticipantRole } from './ticket';
import { resolveStaffAuthorLabel } from '@/lib/discord/staffAuthorLabel';
import { renderTicketChannelName, sanitizeTicketChannelName, usernameSlug } from '@/lib/ticket/channelName';
import { formatChannelRenameError } from '@/lib/discord/channelRename';
import { TRANSCRIPT_SYSTEM_AUTHOR_ID } from '@/lib/transcript/systemMessage';
import { AuditAction, AuditService } from './audit';
import { RealtimeService } from './realtime';
import type { DbClient } from './types';
import type { APIMessageTopLevelComponent } from 'discord.js';

function reactionEmojiResolvable(emoji: MessageReaction['emoji'] | StoredReactionEmoji) {
	if ('id' in emoji && emoji.id) return String(emoji.id);
	return emoji.name ?? null;
}

export type RelayDelivery = {
	targetChannelId: string;
	relayMessageId: string;
	recipientUserId?: string;
};

const DISABLED_MENTIONS = { parse: [] } as const;

export abstract class TicketChannelService {
	static getPrimaryRouting(db: DbClient = container.sqlite) {
		const setup = SetupService.getStatus(undefined, db);
		const primaryGuildId = setup.primaryGuildId;
		if (!primaryGuildId) return null;

		const guild = db.select().from(linkedGuilds).where(eq(linkedGuilds.guildId, primaryGuildId)).get();
		if (!guild?.channelStrategy) return null;

		if (guild.channelStrategy === ChannelStrategy.Category && guild.categoryChannelId) {
			return {
				guildId: primaryGuildId,
				strategy: ChannelStrategy.Category,
				parentId: guild.categoryChannelId
			} as const;
		}

		if (guild.channelStrategy === ChannelStrategy.Forum && guild.forumChannelId) {
			return {
				guildId: primaryGuildId,
				strategy: ChannelStrategy.Forum,
				parentId: guild.forumChannelId
			} as const;
		}

		return null;
	}

	static async provision(user: User, openingMessage: Message, db: DbClient = container.sqlite) {
		return this.provisionFromContent(user, openingMessage.content, user.tag, db, undefined, extractRelayContent(openingMessage));
	}

	static async provisionFromContent(
		user: User,
		openingContent: string | null,
		authorLabel: string,
		db: DbClient = container.sqlite,
		threadId?: number,
		openingRelay?: RelayContent | null
	) {
		const routing = this.getPrimaryRouting(db);
		if (!routing) return null;

		const guild = await container.client.guilds.fetch(routing.guildId).catch(() => null);
		if (!guild) return null;

		const staffRoleIds = db
			.select({ roleId: guildStaffRolePermissions.roleId })
			.from(guildStaffRolePermissions)
			.where(eq(guildStaffRolePermissions.guildId, routing.guildId))
			.all()
			.map((row) => row.roleId);

		const settings = SettingsService.getAppSettings(db);
		const thread = threadId ? TicketService.findById(threadId, db) : null;
		const channelName = renderTicketChannelName(
			settings.ticketChannelNameTemplate,
			{
				ticketId: threadId,
				username: user.username,
				usernameSlug: usernameSlug(user),
				random: thread?.channelNameRandom ?? ''
			},
			routing.strategy
		);
		const openingPayload =
			openingContent === null && !openingRelay
				? null
				: openingRelay
					? await this.buildRelayPayloadFromRelayContent(openingRelay, authorLabel, { disableMentions: true })
					: await this.buildRelayPayload(openingContent ?? '', authorLabel, { disableMentions: true });
		const profilePayload = await this.buildStaffOpenProfilePayload(
			user,
			routing.guildId,
			threadId,
			db,
			'Ticket opened by'
		);

		if (routing.strategy === ChannelStrategy.Forum) {
			const channelId = await this.createForumPost(
				guild,
				routing.parentId,
				channelName,
				user,
				openingPayload,
				profilePayload,
				threadId,
				db
			);
			return channelId ? { channelId, name: channelName } : null;
		}

		const channelId = await this.createCategoryChannel(
			guild,
			routing.parentId,
			channelName,
			staffRoleIds,
			openingPayload,
			profilePayload,
			threadId,
			db
		);
		return channelId ? { channelId, name: channelName } : null;
	}

	/**
	 * Posts the staff-only member profile card to an existing ticket channel and
	 * records it as a System transcript row when the setting is enabled.
	 */
	static async postStaffOpenProfile(
		thread: { id: number; channelId?: string | null },
		user: User,
		options: { headingPrefix?: string; executedBy?: string } = {},
		db: DbClient = container.sqlite
	) {
		if (!thread.channelId) return null;

		const routing = this.getPrimaryRouting(db);
		if (!routing) return null;

		const payload = await this.buildStaffOpenProfilePayload(
			user,
			routing.guildId,
			thread.id,
			db,
			options.headingPrefix ?? 'User added'
		);
		if (!payload) return null;

		const channel = await container.client.channels.fetch(thread.channelId).catch(() => null);
		if (!channel?.isTextBased() || !channel.isSendable()) return null;

		const { transcriptContent, ...discordPayload } = payload;
		const sent = await channel.send(discordPayload);
		this.recordStaffOpenProfileTranscript(
			thread.id,
			thread.channelId,
			sent.id,
			transcriptContent,
			options.executedBy,
			db
		);
		return sent;
	}

	static async resolveParticipantDmChannel(
		participant: { userId: string; dmChannelId?: string | null },
		threadId?: number,
		db: DbClient = container.sqlite
	) {
		if (participant.dmChannelId) {
			const existing = await container.client.channels.fetch(participant.dmChannelId).catch(() => null);
			if (existing?.isDMBased()) return existing as DMChannel;
		}

		const user = await container.client.users.fetch(participant.userId).catch(() => null);
		if (!user) return null;

		const dmChannel = await user.createDM();
		if (threadId && participant.dmChannelId !== dmChannel.id) {
			TicketService.addParticipant(threadId, participant.userId, ParticipantRole.User, { dmChannelId: dmChannel.id }, db);
		}

		return dmChannel;
	}

	static async resolveMemberDmChannel(thread: { id?: number; userId: string; dmChannelId?: string | null }) {
		if (thread.id) {
			const participant = TicketService.getUserParticipant(thread.id, thread.userId);
			if (participant) {
				return this.resolveParticipantDmChannel(participant, thread.id);
			}
		}

		if (thread.dmChannelId) {
			const existing = await container.client.channels.fetch(thread.dmChannelId).catch(() => null);
			if (existing?.isDMBased()) return existing as DMChannel;
		}

		const user = await container.client.users.fetch(thread.userId).catch(() => null);
		if (!user) return null;

		return user.createDM();
	}

	static async relayMemberMessage(
		message: Message,
		thread: { id: number; channelId?: string | null; userId: string; hideMemberIdentities?: boolean }
	): Promise<RelayDelivery[]> {
		const deliveries: RelayDelivery[] = [];
		const referencedMessageId = MessageService.getReferencedDiscordMessageId(message);

		if (thread.channelId) {
			const channel = await container.client.channels.fetch(thread.channelId).catch(() => null);
			if (channel?.isTextBased() && channel.isSendable()) {
				const payload = await this.buildRelayPayloadFromMessage(message, message.author.tag, {
					disableMentions: true
				});
				const replyToMessageId = referencedMessageId
					? MessageService.resolveRelayReplyTarget(referencedMessageId, message.channel.id, thread.channelId)
					: undefined;
				const sent = await this.sendRelayPayload(channel, payload, replyToMessageId);
				deliveries.push({
					targetChannelId: thread.channelId,
					relayMessageId: sent.id
				});
			}
		}

		const participants = TicketService.listUserParticipants(thread.id);
		const otherParticipants = participants.filter((participant) => participant.userId !== message.author.id);
		if (otherParticipants.length === 0) return deliveries;

		for (const participant of otherParticipants) {
			const dmChannel = await this.resolveParticipantDmChannel(participant, thread.id);
			if (!dmChannel?.isDMBased()) continue;

			const authorLabel = TicketService.memberAuthorLabel(thread, message.author.id, message.author.tag);
			const payload = await this.buildRelayPayloadFromMessage(message, authorLabel);
			const replyToMessageId = referencedMessageId
				? MessageService.resolveRelayReplyTarget(referencedMessageId, message.channel.id, dmChannel.id)
				: undefined;
			const sent = await this.sendRelayPayload(dmChannel, payload, replyToMessageId);
			deliveries.push({
				targetChannelId: dmChannel.id,
				relayMessageId: sent.id,
				recipientUserId: participant.userId
			});
		}

		return deliveries;
	}

	static async relayStaffMessage(
		message: Message,
		thread: { id: number; userId: string; dmChannelId?: string | null },
		db: DbClient = container.sqlite
	): Promise<RelayDelivery[]> {
		const authorLabel = await resolveStaffAuthorLabel(message, db);
		const payload = await this.buildRelayPayloadFromMessage(message, authorLabel);
		const deliveries: RelayDelivery[] = [];
		const participants = TicketService.listUserParticipants(thread.id, db);
		const referencedMessageId = MessageService.getReferencedDiscordMessageId(message);

		for (const participant of participants) {
			const channel = await this.resolveParticipantDmChannel(participant, thread.id, db);
			if (!channel?.isDMBased()) continue;

			const replyToMessageId = referencedMessageId
				? MessageService.resolveRelayReplyTarget(referencedMessageId, message.channel.id, channel.id, db)
				: undefined;
			const sent = await this.sendRelayPayload(channel, payload, replyToMessageId);
			deliveries.push({
				targetChannelId: channel.id,
				relayMessageId: sent.id,
				recipientUserId: participant.userId
			});

			if (participant.userId === thread.userId && thread.id) {
				TicketService.setDmChannelId(thread.id, channel.id, db);
			}
		}

		return deliveries;
	}

	static async updateRelayMessage(
		stored: {
			id?: number;
			channelId: string;
			authorId: string;
			relayMessageId: string | null;
			content: string;
			isForwarded?: boolean;
		},
		thread: {
			id: number;
			channelId?: string | null;
			dmChannelId?: string | null;
			userId: string;
			hideMemberIdentities?: boolean;
		},
		options: { staffAuthorLabel?: string; memberTag?: string } = {}
	) {
		const relays = stored.id ? MessageRelayService.listByMessage(stored.id) : [];

		if (relays.length === 0) {
			if (!stored.relayMessageId) return;
			const targetChannelId =
				stored.channelId === thread.dmChannelId ? thread.channelId : thread.dmChannelId;
			if (!targetChannelId) return;
			const authorLabel = this.resolveRelayAuthorLabel(thread, stored.authorId, targetChannelId, options);
			await this.updateSingleRelayMessage(stored, thread, authorLabel, {
				targetChannelId,
				relayMessageId: stored.relayMessageId
			});
			return;
		}

		for (const relay of relays) {
			const authorLabel = this.resolveRelayAuthorLabel(thread, stored.authorId, relay.targetChannelId, options);
			await this.updateSingleRelayMessage(stored, thread, authorLabel, relay);
		}
	}

	private static resolveRelayAuthorLabel(
		thread: { id: number; channelId?: string | null; hideMemberIdentities?: boolean },
		authorId: string,
		targetChannelId: string,
		options: { staffAuthorLabel?: string; memberTag?: string }
	) {
		if (options.staffAuthorLabel !== undefined) {
			return options.staffAuthorLabel;
		}

		const memberTag = options.memberTag ?? 'Member';
		if (targetChannelId === thread.channelId) {
			return memberTag;
		}

		return TicketService.memberAuthorLabel(thread, authorId, memberTag);
	}

	private static async updateSingleRelayMessage(
		stored: { channelId: string; content: string; isForwarded?: boolean },
		thread: { id: number; channelId?: string | null; dmChannelId?: string | null; userId: string },
		authorLabel: string | undefined,
		relay: { targetChannelId: string; relayMessageId: string }
	) {
		const relayChannel = await container.client.channels.fetch(relay.targetChannelId).catch(() => null);
		if (!relayChannel?.isTextBased()) {
			container.logger.warn(
				`Could not resolve relay channel for message ${relay.relayMessageId} (target ${relay.targetChannelId})`
			);
			return;
		}

		const relayMessage = await relayChannel.messages.fetch(relay.relayMessageId).catch((error) => {
			container.logger.warn(`Could not fetch relay message ${relay.relayMessageId}`, error);
			return null;
		});
		if (!relayMessage?.editable) {
			container.logger.warn(`Relay message ${relay.relayMessageId} is not editable`);
			return;
		}

		const participantDmChannelIds = new Set(
			TicketService.listUserParticipants(thread.id)
				.map((participant) => participant.dmChannelId)
				.filter((channelId): channelId is string => Boolean(channelId))
		);
		const toStaff = stored.channelId === thread.dmChannelId || participantDmChannelIds.has(stored.channelId);
		const payload = await this.buildRelayPayload(stored.content, authorLabel, {
			disableMentions: toStaff
		}, undefined, undefined, stored.isForwarded ?? false);
		await relayMessage
			.edit({
				components: payload.components,
				flags: MessageFlags.IsComponentsV2,
				...(toStaff ? { allowedMentions: DISABLED_MENTIONS } : {})
			})
			.catch((error) => {
				container.logger.warn(`Failed to edit relay message ${relay.relayMessageId}`, error);
			});
	}

	static async staffAuthorLabel(message: Message, db: DbClient = container.sqlite) {
		return resolveStaffAuthorLabel(message, db);
	}

	static async renameStaffChannel(
		channelId: string,
		rawName: string,
		executedBy: string,
		db: DbClient = container.sqlite,
		channelHint?: GuildBasedChannel | null
	) {
		const thread = TicketService.findOpenByStaffChannelId(channelId, db);
		if (!thread) {
			throw new Error('Ticket not found for this channel.');
		}

		const routing = this.getPrimaryRouting(db);
		if (!routing) {
			throw new Error('Ticket channels are not configured.');
		}

		const name = sanitizeTicketChannelName(rawName, routing.strategy);
		const channel =
			channelHint && channelHint.id === channelId
				? channelHint
				: await container.client.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased()) {
			throw new Error('Could not resolve this ticket channel.');
		}

		try {
			if (channel.isThread()) {
				await channel.setName(name);
			} else if (channel.type === ChannelType.GuildText) {
				await channel.setName(name);
			} else {
				throw new Error('This channel cannot be renamed.');
			}
		} catch (error) {
			throw new Error(formatChannelRenameError(error));
		}

		try {
			AuditService.log(
				{
					action: AuditAction.ThreadRenamed,
					executedBy,
					threadId: thread.id,
					channelId,
					payload: { name }
				},
				db
			);

			TicketService.setStaffChannelName(thread.id, name, db);

			RealtimeService.publish({
				type: 'ticket.updated',
				ticketId: thread.id,
				staffChannelName: name
			});
		} catch (error) {
			container.logger.warn(
				`Ticket channel renamed in Discord but local rename bookkeeping failed for thread #${thread.id}`,
				error
			);
		}

		return { threadId: thread.id, name };
	}

	static async mirrorReactionToLinkedMessages(
		emoji: MessageReaction['emoji'] | StoredReactionEmoji,
		targets: { targetChannelId: string; targetMessageId: string }[]
	) {
		const reactEmoji = reactionEmojiResolvable(emoji);
		if (!reactEmoji) return;

		for (const target of targets) {
			const channel = await container.client.channels.fetch(target.targetChannelId).catch(() => null);
			if (!channel?.isTextBased()) continue;

			const relayMessage = await channel.messages.fetch(target.targetMessageId).catch((error) => {
				container.logger.warn(`Could not fetch relay message ${target.targetMessageId} for reaction mirror`, error);
				return null;
			});
			if (!relayMessage) continue;

			await relayMessage.react(reactEmoji).catch((error) => {
				container.logger.warn(`Failed to mirror reaction onto message ${target.targetMessageId}`, error);
			});
		}
	}

	/**
	 * Removes this bot's mirrored reaction from linked Discord copies.
	 * Caller must confirm no humans remain on the logical message (DB) first —
	 * checking only the Discord message where someone just removed a reaction
	 * is wrong for multi-participant tickets.
	 */
	static async mirrorReactionRemoveFromLinkedMessages(
		emoji: MessageReaction['emoji'] | StoredReactionEmoji,
		targets: { targetChannelId: string; targetMessageId: string }[]
	) {
		const botId = container.client.user?.id;
		if (!botId) return;

		const reactionIdentifier = reactionEmojiResolvable(emoji);
		if (!reactionIdentifier) return;

		for (const target of targets) {
			const channel = await container.client.channels.fetch(target.targetChannelId).catch(() => null);
			if (!channel?.isTextBased()) continue;

			const relayMessage = await channel.messages.fetch(target.targetMessageId).catch((error) => {
				container.logger.warn(
					`Could not fetch relay message ${target.targetMessageId} for reaction mirror removal`,
					error
				);
				return null;
			});
			if (!relayMessage) continue;

			const reaction =
				relayMessage.reactions.resolve(reactionIdentifier) ??
				relayMessage.reactions.cache.find((entry) =>
					reactionEmojiMatches(entry.emoji, emoji as StoredReactionEmoji)
				);
			if (!reaction) continue;

			await reaction.users.remove(botId).catch((error) => {
				container.logger.warn(`Failed to remove mirrored reaction from message ${target.targetMessageId}`, error);
			});
		}
	}

	static async deleteStaffChannel(channelId: string) {
		try {
			const channel = await container.client.channels.fetch(channelId).catch(() => null);
			if (!channel || !('delete' in channel) || typeof channel.delete !== 'function') return;

			await channel.delete('Ticket closed');
		} catch (error) {
			container.logger.warn(`Failed to delete staff channel ${channelId}`, error);
		}
	}

	private static async sendRelayPayload(
		channel: { send: (options: MessageCreateOptions) => Promise<Message> },
		payload: MessageCreateOptions,
		replyToMessageId?: string
	) {
		if (!replyToMessageId) {
			return channel.send(payload);
		}

		return channel.send({
			...payload,
			reply: {
				messageReference: replyToMessageId,
				failIfNotExists: false
			}
		});
	}

	private static async buildRelayPayloadFromMessage(
		message: Message,
		author?: string,
		options: { disableMentions?: boolean } = {}
	) {
		return this.buildRelayPayloadFromRelayContent(extractRelayContent(message), author, options, message.createdAt);
	}

	private static async buildRelayPayloadFromRelayContent(
		relay: RelayContent,
		author?: string,
		options: { disableMentions?: boolean } = {},
		timestamp = new Date()
	): Promise<MessageCreateOptions> {
		const fallbackText =
			relay.media.length > 0 || relay.linkPreviews.length > 0 ? '' : '(no message content)';
		return this.buildRelayPayload(
			relay.text || fallbackText,
			author,
			options,
			timestamp,
			relay.media,
			relay.isForwarded,
			relay.linkPreviews
		);
	}

	private static async buildRelayPayload(
		content: string,
		author?: string,
		options: { disableMentions?: boolean } = {},
		timestamp = new Date(),
		media?: RelayContent['media'],
		forwarded = false,
		linkPreviews?: RelayContent['linkPreviews']
	): Promise<MessageCreateOptions> {
		const hasRenderableContent = Boolean(
			content.trim() || media?.length || linkPreviews?.length
		);
		const components = await RelayMessage.render({
			author,
			message: content.trim() || (hasRenderableContent ? '' : '(no message content)'),
			timestamp: time(timestamp, 'f'),
			media,
			linkPreviews,
			forwarded
		});

		return {
			components,
			flags: MessageFlags.IsComponentsV2,
			...(options.disableMentions ? { allowedMentions: DISABLED_MENTIONS } : {})
		};
	}

	private static async buildStaffOpenProfilePayload(
		user: User,
		primaryGuildId: string,
		threadId: number | undefined,
		db: DbClient,
		headingPrefix: string
	): Promise<(MessageCreateOptions & { components: APIMessageTopLevelComponent[]; transcriptContent: string }) | null> {
		const settings = SettingsService.getAppSettings(db);
		if (settings.staffTicketOpenProfile === false) return null;

		const setup = SetupService.getStatus(undefined, db);
		const linkedGuilds = setup.linkedGuilds;
		const primaryGuild = await container.client.guilds.fetch(primaryGuildId).catch(() => null);
		const primaryMember = primaryGuild ? await primaryGuild.members.fetch(user.id).catch(() => null) : null;
		const mutualServers = await this.resolveLinkedMutualServers(user.id, linkedGuilds, primaryGuild);
		const userMention = `<@${user.id}>`;
		const displayName = primaryMember?.displayName ?? user.globalName ?? user.username;
		const roleMentions = primaryMember ? formatRoleMentions(primaryMember) : 'None';
		const roleNames = primaryMember ? formatRoleNames(primaryMember) : 'None';
		const mutual = formatList(mutualServers, 'None');
		const accountCreatedAt = time(user.createdAt, 'F');
		const joinedMainGuildAt = primaryMember?.joinedAt ? time(primaryMember.joinedAt, 'F') : 'Not in main server';
		const previousTicketCount = TicketService.countTicketsForUser(user.id, threadId, db);

		const components = await StaffTicketOpenProfile.render({
			heading: `${headingPrefix} ${userMention}`,
			userMention,
			accountCreatedAt,
			joinedMainGuildAt,
			previousTicketCount,
			nickname: primaryMember?.nickname ?? 'None',
			roles: roleMentions,
			mutualServers: mutual
		});

		const transcriptContent = [
			`# ${headingPrefix} [${displayName}](https://discord.com/users/${user.id})`,
			`**Account created:** ${accountCreatedAt}`,
			`**Joined main server:** ${joinedMainGuildAt}`,
			`**Previous tickets:** ${previousTicketCount}`,
			`**Main server nickname:** ${primaryMember?.nickname ?? 'None'}`,
			`**Main server roles:** ${roleNames}`,
			`**Mutual linked servers:** ${mutual}`
		].join('\n\n');

		return {
			components,
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: DISABLED_MENTIONS,
			transcriptContent
		};
	}

	private static recordStaffOpenProfileTranscript(
		threadId: number,
		staffChannelId: string,
		discordMessageId: string,
		transcriptContent: string,
		executedBy: string | undefined,
		_db: DbClient
	) {
		const content = transcriptContent.trim();
		if (!content) return;

		MessageService.create({
			threadId,
			channelId: staffChannelId,
			authorId: TRANSCRIPT_SYSTEM_AUTHOR_ID,
			messageId: discordMessageId,
			content,
			executedBy: executedBy ?? TRANSCRIPT_SYSTEM_AUTHOR_ID
		});
	}

	private static async resolveLinkedMutualServers(
		userId: string,
		linkedGuilds: ReturnType<typeof SetupService.getStatus>['linkedGuilds'],
		primaryGuild: Guild | null
	) {
		const names: string[] = [];

		for (const linkedGuild of linkedGuilds) {
			const guild =
				primaryGuild?.id === linkedGuild.guildId
					? primaryGuild
					: await container.client.guilds.fetch(linkedGuild.guildId).catch(() => null);
			if (!guild) continue;

			const member = await guild.members.fetch(userId).catch(() => null);
			if (!member) continue;

			names.push(guild.name);
		}

		return names;
	}

	private static async createForumPost(
		guild: Guild,
		forumChannelId: string,
		name: string,
		user: User,
		openingPayload: Awaited<ReturnType<typeof TicketChannelService.buildRelayPayload>> | null,
		profilePayload: Awaited<ReturnType<typeof TicketChannelService.buildStaffOpenProfilePayload>>,
		threadId: number | undefined,
		db: DbClient
	) {
		const forum = await guild.channels.fetch(forumChannelId).catch(() => null);
		if (!forum || forum.type !== ChannelType.GuildForum) return null;

		const forumMessage = profilePayload
			? (() => {
					const { transcriptContent: _, ...discordPayload } = profilePayload;
					return discordPayload;
				})()
			: (openingPayload ?? { content: `Ticket opened for ${user.tag}` });

		const post = await forum.threads.create({
			name,
			message: forumMessage
		});

		if (profilePayload && threadId) {
			const starter = await post.fetchStarterMessage().catch(() => null);
			if (starter) {
				this.recordStaffOpenProfileTranscript(
					threadId,
					post.id,
					starter.id,
					profilePayload.transcriptContent,
					undefined,
					db
				);
			}
		}

		if (profilePayload && openingPayload) {
			await post.send(openingPayload);
		}

		return post.id;
	}

	private static async createCategoryChannel(
		guild: Guild,
		categoryId: string,
		name: string,
		staffRoleIds: string[],
		openingPayload: Awaited<ReturnType<typeof TicketChannelService.buildRelayPayload>> | null,
		profilePayload: Awaited<ReturnType<typeof TicketChannelService.buildStaffOpenProfilePayload>>,
		threadId: number | undefined,
		db: DbClient
	) {
		const category = await guild.channels.fetch(categoryId).catch(() => null);
		if (!category || category.type !== ChannelType.GuildCategory) return null;

		const overwrites: OverwriteResolvable[] = [
			{
				id: guild.roles.everyone.id,
				deny: [PermissionFlagsBits.ViewChannel]
			},
			...staffRoleIds.map((roleId) => ({
				id: roleId,
				allow: [
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.SendMessages,
					PermissionFlagsBits.ReadMessageHistory,
					PermissionFlagsBits.AttachFiles,
					PermissionFlagsBits.EmbedLinks
				]
			}))
		];

		const channel = await guild.channels.create({
			name,
			type: ChannelType.GuildText,
			parent: categoryId,
			permissionOverwrites: overwrites,
			topic: 'Modmail ticket channel'
		});

		if (profilePayload) {
			const { transcriptContent, ...discordPayload } = profilePayload;
			const sent = await channel.send(discordPayload);
			if (threadId) {
				this.recordStaffOpenProfileTranscript(
					threadId,
					channel.id,
					sent.id,
					transcriptContent,
					undefined,
					db
				);
			}
		}
		if (openingPayload) {
			await channel.send(openingPayload);
		}

		return channel.id;
	}
}

function formatRoleMentions(member: GuildMember) {
	const roles = [...member.roles.cache.values()]
		.filter((role) => role.id !== member.guild.id)
		.sort((a: Role, b: Role) => b.position - a.position)
		.map((role) => `<@&${role.id}>`);

	return formatList(roles, 'None', 12);
}

function formatRoleNames(member: GuildMember) {
	const roles = [...member.roles.cache.values()]
		.filter((role) => role.id !== member.guild.id)
		.sort((a: Role, b: Role) => b.position - a.position)
		.map((role) => role.name);

	return formatList(roles, 'None', 12);
}

function formatList(items: string[], empty: string, limit = 10) {
	if (items.length === 0) return empty;
	const visible = items.slice(0, limit);
	const remaining = items.length - visible.length;
	return remaining > 0 ? `${visible.join(', ')} (+${remaining} more)` : visible.join(', ');
}
