import { MessageReferenceType, type Attachment, type Embed, type Message } from 'discord.js';
import {
	extractLinkPreviewsFromText,
	mergeLinkPreviews,
	stripLinkPreviewUrls,
	toLinkPreviewFromEmbed,
	type RelayLinkPreview
} from './linkPreview';

export type { RelayLinkPreview } from './linkPreview';

export type RelayMediaItem = {
	url: string;
	description?: string;
	spoiler?: boolean;
	width?: number | null;
	height?: number | null;
};

export type RelayAttachmentItem = {
	url: string;
	name?: string | null;
	isSpoiler?: boolean;
	width?: number | null;
	height?: number | null;
};

export type RelayContent = {
	text: string;
	media: RelayMediaItem[];
	attachments: RelayAttachmentItem[];
	linkPreviews: RelayLinkPreview[];
	isForwarded: boolean;
};

const IMAGE_CONTENT_TYPE_PATTERN = /^image\//i;
const VIDEO_CONTENT_TYPE_PATTERN = /^video\//i;
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const EMBED_MEDIA_HOST_PATTERN = /(?:youtube\.com|youtu\.be|veed\.io)/i;

export function extractRelayContent(message: Message): RelayContent {
	const isForwarded = message.reference?.type === MessageReferenceType.Forward;
	const textParts: string[] = [];
	const media = new Map<string, RelayMediaItem>();
	const attachments: RelayAttachmentItem[] = [];
	const linkPreviewGroups: RelayLinkPreview[][] = [];

	if (isForwarded) {
		for (const snapshot of message.messageSnapshots.values()) {
			extractFromSource(snapshot, textParts, media, attachments, linkPreviewGroups);
		}

		extractFromSource(
			{
				attachments: message.attachments,
				embeds: message.embeds
			},
			textParts,
			media,
			attachments,
			linkPreviewGroups
		);
	} else {
		extractFromSource(message, textParts, media, attachments, linkPreviewGroups);
	}

	const linkPreviews = mergeLinkPreviews(...linkPreviewGroups);
	const text = stripLinkPreviewUrls(textParts.join('\n\n').trim(), linkPreviews);

	return {
		text,
		media: [...media.values()].slice(0, 10),
		attachments: dedupeAttachments(attachments),
		linkPreviews,
		isForwarded
	};
}

export function formatForwardedDiscordText(text: string) {
	const trimmed = text.trim();
	if (!trimmed) return '';

	return trimmed
		.split('\n')
		.map((line) => (line.length > 0 ? `> ${line}` : '>'))
		.join('\n');
}

function extractFromSource(
	source: {
		content?: string | null;
		attachments?: Message['attachments'];
		embeds?: Embed[];
	},
	textParts: string[],
	media: Map<string, RelayMediaItem>,
	attachments: RelayAttachmentItem[],
	linkPreviewGroups: RelayLinkPreview[][]
) {
	const content = source.content?.trim();
	if (content) {
		textParts.push(content);
		linkPreviewGroups.push(extractLinkPreviewsFromText(content));
	}

	for (const attachment of source.attachments?.values() ?? []) {
		const item = toAttachmentItem(attachment);
		attachments.push(item);

		const mediaItem = toMediaItemFromAttachment(attachment);
		if (mediaItem) upsertMedia(media, mediaItem);
	}

	for (const embed of source.embeds ?? []) {
		const linkPreview = toLinkPreviewFromEmbed(embed);
		if (linkPreview) {
			linkPreviewGroups.push([linkPreview]);
			continue;
		}

		const embedText = formatEmbedText(embed);
		if (embedText) textParts.push(embedText);

		const mediaItem = toMediaItemFromEmbed(embed);
		if (mediaItem) upsertMedia(media, mediaItem);
	}
}

function toAttachmentItem(attachment: Attachment): RelayAttachmentItem {
	const dims = normalizeMediaDimensions(attachment.width, attachment.height);
	return {
		url: attachment.url,
		name: attachment.name,
		isSpoiler: attachment.spoiler ?? false,
		...dims
	};
}

function toMediaItemFromAttachment(attachment: Attachment): RelayMediaItem | null {
	const contentType = attachment.contentType ?? '';
	if (
		IMAGE_CONTENT_TYPE_PATTERN.test(contentType) ||
		VIDEO_CONTENT_TYPE_PATTERN.test(contentType) ||
		IMAGE_EXTENSION_PATTERN.test(attachment.url) ||
		VIDEO_EXTENSION_PATTERN.test(attachment.url)
	) {
		const dims = normalizeMediaDimensions(attachment.width, attachment.height);
		return {
			url: attachment.url,
			description: attachment.name ?? undefined,
			spoiler: attachment.spoiler ?? false,
			...dims
		};
	}

	return null;
}

function toMediaItemFromEmbed(embed: Embed): RelayMediaItem | null {
	if (embed.url?.trim() && EMBED_MEDIA_HOST_PATTERN.test(embed.url)) {
		return null;
	}

	const image = embed.image ?? embed.thumbnail;
	if (image?.url) {
		const dims = normalizeMediaDimensions(image.width, image.height);
		return {
			url: image.url,
			description: embed.title ?? embed.description ?? undefined,
			...dims
		};
	}

	const video = embed.video;
	if (video?.url) {
		const dims = normalizeMediaDimensions(video.width, video.height);
		return {
			url: video.url,
			description: embed.title ?? embed.description ?? undefined,
			...dims
		};
	}

	return null;
}

function formatEmbedText(embed: Embed) {
	const parts = [embed.title, embed.description, embed.url].filter((value): value is string => Boolean(value?.trim()));
	return parts.join('\n').trim();
}

function upsertMedia(media: Map<string, RelayMediaItem>, item: RelayMediaItem) {
	const existing = media.get(item.url);
	if (!existing) {
		media.set(item.url, item);
		return;
	}

	media.set(item.url, {
		...existing,
		description: existing.description ?? item.description,
		spoiler: existing.spoiler ?? item.spoiler,
		width: existing.width ?? item.width ?? null,
		height: existing.height ?? item.height ?? null
	});
}

function normalizeMediaDimensions(width?: number | null, height?: number | null) {
	if (
		typeof width !== 'number' ||
		typeof height !== 'number' ||
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		width <= 0 ||
		height <= 0
	) {
		return { width: null, height: null };
	}

	return { width: Math.round(width), height: Math.round(height) };
}

function dedupeAttachments(items: RelayAttachmentItem[]) {
	const byUrl = new Map<string, RelayAttachmentItem>();
	for (const item of items) {
		const existing = byUrl.get(item.url);
		if (!existing) {
			byUrl.set(item.url, item);
			continue;
		}
		byUrl.set(item.url, {
			...existing,
			name: existing.name ?? item.name,
			isSpoiler: existing.isSpoiler ?? item.isSpoiler,
			width: existing.width ?? item.width ?? null,
			height: existing.height ?? item.height ?? null
		});
	}
	return [...byUrl.values()];
}

export function isImageMediaUrl(url: string) {
	return IMAGE_EXTENSION_PATTERN.test(url);
}

export function isVideoMediaUrl(url: string) {
	return VIDEO_EXTENSION_PATTERN.test(url) || EMBED_MEDIA_HOST_PATTERN.test(url);
}

export function toYoutubeEmbedUrl(url: string) {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === 'youtu.be') {
			const id = parsed.pathname.replace('/', '');
			return id ? `https://www.youtube.com/embed/${id}` : null;
		}

		if (parsed.hostname.includes('youtube.com')) {
			const id = parsed.searchParams.get('v');
			return id ? `https://www.youtube.com/embed/${id}` : null;
		}
	} catch {
		return null;
	}

	return null;
}

export function toVeedEmbedUrl(url: string) {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.includes('veed.io')) return null;
		if (parsed.pathname.startsWith('/embed/')) return url;
		const match = parsed.pathname.match(/\/view\/([^/]+)/i);
		return match?.[1] ? `https://www.veed.io/embed/${match[1]}` : url;
	} catch {
		return null;
	}
}
