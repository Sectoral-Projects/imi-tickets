import { config, linkedGuilds } from '@/database/sqlite/schema';
import { TicketChannelPanel } from '@/lib/components/ticketChannelPanel';
import { ChannelButtonCustomIdPrefix, ChannelOpenButtonService } from '@/services/channelOpenButton';
import { DiscordChannelService } from '@/services/discordChannel';
import { container } from '@sapphire/framework';
import { ChannelType, MessageFlags, type APIMessageTopLevelComponent } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { DbClient } from './types';

export const DEFAULT_CHANNEL_PANEL_FORUM_TITLE = 'Open a ticket';

export interface ChannelPanelConfig {
	enabled: boolean;
	channelId: string | null;
	forumThreadId: string | null;
	messageId: string | null;
	forumPostTitle: string | null;
	/** Delete + send a fresh message on update instead of editing (no Discord "(edited)" label). */
	repostOnUpdate: boolean;
}

export interface ChannelPanelPublishResult {
	channelId: string;
	messageId: string;
	forumThreadId: string | null;
}

export abstract class ChannelPanelService {
	static getConfig(db: DbClient = container.sqlite): ChannelPanelConfig {
		const row = db.select().from(config).limit(1).get();
		return {
			enabled: row?.channelPanelEnabled ?? false,
			channelId: row?.channelPanelChannelId ?? null,
			forumThreadId: row?.channelPanelForumThreadId ?? null,
			messageId: row?.channelPanelMessageId ?? null,
			forumPostTitle: row?.channelPanelForumPostTitle ?? null,
			repostOnUpdate: row?.channelPanelRepostOnUpdate ?? false
		};
	}

	static updateConfig(
		patch: Partial<{
			enabled: boolean;
			channelId: string | null;
			forumThreadId: string | null;
			messageId: string | null;
			forumPostTitle: string | null;
			repostOnUpdate: boolean;
		}>,
		db: DbClient = container.sqlite
	) {
		const row = db.select().from(config).limit(1).get();
		if (!row) throw new Error('Configuration has not been initialized');

		const values = {
			channelPanelEnabled: patch.enabled ?? row.channelPanelEnabled,
			channelPanelChannelId:
				patch.channelId === undefined ? row.channelPanelChannelId : normalizeId(patch.channelId),
			channelPanelForumThreadId:
				patch.forumThreadId === undefined ? row.channelPanelForumThreadId : normalizeId(patch.forumThreadId),
			channelPanelMessageId:
				patch.messageId === undefined ? row.channelPanelMessageId : normalizeId(patch.messageId),
			channelPanelForumPostTitle:
				patch.forumPostTitle === undefined
					? row.channelPanelForumPostTitle
					: normalizeForumPostTitle(patch.forumPostTitle),
			channelPanelRepostOnUpdate:
				patch.repostOnUpdate === undefined
					? row.channelPanelRepostOnUpdate
					: patch.repostOnUpdate,
			updatedAt: new Date()
		};

		db.update(config).set(values).where(eq(config.id, row.id)).run();
		return this.getConfig(db);
	}

	static async buildPanelComponents(): Promise<APIMessageTopLevelComponent[]> {
		const buttons = ChannelOpenButtonService.listEnabled();
		const base = await TicketChannelPanel.render();
		return ChannelOpenButtonService.appendButtonsToComponents(
			base,
			buttons,
			ChannelButtonCustomIdPrefix.Open
		);
	}

	static async publish(db: DbClient = container.sqlite): Promise<ChannelPanelPublishResult> {
		const panelConfig = this.getConfig(db);
		if (!panelConfig.channelId) {
			throw new Error('Choose a channel before publishing the panel');
		}

		const buttons = ChannelOpenButtonService.listEnabled();
		if (buttons.length === 0) {
			throw new Error('Add at least one enabled channel panel button before publishing');
		}

		await this.assertValidPanelChannel(panelConfig.channelId, db);

		const components = await this.buildPanelComponents();
		const target = await this.resolvePublishTarget(panelConfig, components, db);

		if (panelConfig.messageId) {
			if (panelConfig.repostOnUpdate) {
				await DiscordChannelService.deleteMessage(target.channelId, panelConfig.messageId);
			} else {
				const edited = await DiscordChannelService.editComponents(
					target.channelId,
					panelConfig.messageId,
					components
				);
				if (edited) {
					this.updateConfig(
						{
							messageId: edited.id,
							forumThreadId: target.forumThreadId
						},
						db
					);
					return {
						channelId: target.channelId,
						messageId: edited.id,
						forumThreadId: target.forumThreadId
					};
				}
			}
		}

		const sent = await DiscordChannelService.sendComponents(target.channelId, components);
		if (!sent) {
			throw new Error('Failed to publish the channel panel. Check bot permissions in the target channel.');
		}

		this.updateConfig(
			{
				messageId: sent.id,
				forumThreadId: target.forumThreadId
			},
			db
		);

		return {
			channelId: target.channelId,
			messageId: sent.id,
			forumThreadId: target.forumThreadId
		};
	}

	/**
	 * When a Discord panel message is already linked, re-render and sync it
	 * (edit in place, or delete+repost when `repostOnUpdate` is on). No-op when unpublished.
	 */
	static async syncPublishedMessageIfLinked(
		db: DbClient = container.sqlite
	): Promise<ChannelPanelPublishResult | null> {
		const panelConfig = this.getConfig(db);
		if (!panelConfig.messageId || !panelConfig.channelId) return null;
		return this.publish(db);
	}

	private static async resolvePublishTarget(
		panelConfig: ChannelPanelConfig,
		components: APIMessageTopLevelComponent[],
		db: DbClient
	) {
		if (panelConfig.forumThreadId) {
			return {
				channelId: panelConfig.forumThreadId,
				forumThreadId: panelConfig.forumThreadId
			};
		}

		const channel = await container.client.channels.fetch(panelConfig.channelId!).catch(() => null);
		if (!channel) {
			throw new Error('The selected channel could not be found');
		}

		if (channel.type === ChannelType.GuildForum) {
			const title = panelConfig.forumPostTitle?.trim() || DEFAULT_CHANNEL_PANEL_FORUM_TITLE;
			const post = await channel.threads.create({
				name: title.slice(0, 100),
				message: { components, flags: MessageFlags.IsComponentsV2 }
			});

			const starter = await post.fetchStarterMessage().catch(() => null);
			const messageId = starter?.id ?? post.id;

			this.updateConfig(
				{
					forumThreadId: post.id,
					messageId
				},
				db
			);

			return {
				channelId: post.id,
				forumThreadId: post.id
			};
		}

		if (!channel.isTextBased() || !channel.isSendable()) {
			throw new Error('The selected channel must be a text channel or forum');
		}

		return {
			channelId: channel.id,
			forumThreadId: null
		};
	}

	private static async assertValidPanelChannel(channelId: string, db: DbClient) {
		const primaryGuildId = db.select().from(config).limit(1).get()?.primaryGuildId;
		if (!primaryGuildId) return;

		const guild = await container.client.guilds.fetch(primaryGuildId).catch(() => null);
		if (!guild) return;

		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel) {
			throw new Error('The selected channel is not in the linked primary server');
		}

		const routing = db
			.select()
			.from(linkedGuilds)
			.where(eq(linkedGuilds.guildId, primaryGuildId))
			.limit(1)
			.get();

		if (routing?.forumChannelId === channelId || routing?.categoryChannelId === channelId) {
			throw new Error('The channel ticket panel cannot use the ticket routing category or forum channel');
		}
	}
}

function normalizeId(value: string | null | undefined) {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeForumPostTitle(value: string | null | undefined) {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 100) : null;
}
