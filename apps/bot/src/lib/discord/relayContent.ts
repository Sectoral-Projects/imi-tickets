import {
	AttachmentBuilder,
	EmbedType,
	MessageReferenceType,
	type Attachment,
	type Embed,
	type Message
} from 'discord.js';
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
	/** Discord CDN proxy for the asset — preferred when re-uploading (origin CDNs often block bots). */
	proxyUrl?: string;
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
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>]+/gi;
const DISCORD_ATTACHMENT_HOST_PATTERN =
	/(?:^|\.)(?:cdn\.discordapp\.com|media\.discordapp\.net)$/i;
/** Components V2 Media Gallery is unreliable with first-seen external CDN URLs — re-upload under this size. */
const RELAY_MEDIA_REUPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export function extractRelayContent(message: Message): RelayContent {
	const isForwarded = message.reference?.type === MessageReferenceType.Forward;
	const textParts: string[] = [];
	const media = new Map<string, RelayMediaItem>();
	const attachments: RelayAttachmentItem[] = [];
	const linkPreviewGroups: RelayLinkPreview[][] = [];
	const redundantMediaUrls: string[] = [];

	if (isForwarded) {
		for (const snapshot of message.messageSnapshots.values()) {
			extractFromSource(snapshot, textParts, media, attachments, linkPreviewGroups, redundantMediaUrls);
		}

		extractFromSource(
			{
				attachments: message.attachments,
				embeds: message.embeds
			},
			textParts,
			media,
			attachments,
			linkPreviewGroups,
			redundantMediaUrls
		);
	} else {
		extractFromSource(message, textParts, media, attachments, linkPreviewGroups, redundantMediaUrls);
	}

	const linkPreviews = mergeLinkPreviews(...linkPreviewGroups);
	const text = stripRedundantMediaUrls(
		stripLinkPreviewUrls(textParts.join('\n\n').trim(), linkPreviews),
		redundantMediaUrls,
		[...media.values()].map((item) => item.url)
	);

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
	linkPreviewGroups: RelayLinkPreview[][],
	redundantMediaUrls: string[]
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

		// Image / GIF / video unfurls: media only — never dump SEO title + page URL into text.
		if (isMediaUnfurlEmbed(embed)) {
			collectEmbedUrls(embed, redundantMediaUrls);
			const mediaItem = toMediaItemFromMediaEmbed(embed);
			if (mediaItem) {
				upsertMedia(media, mediaItem);
				redundantMediaUrls.push(mediaItem.url);
			}
			continue;
		}

		const embedText = formatEmbedText(embed);
		if (embedText) textParts.push(embedText);

		const mediaItem = toMediaItemFromEmbed(embed);
		if (mediaItem) upsertMedia(media, mediaItem);
	}

	if (!content) return;

	// Paste direct CDN links only when Discord did not already unfurl media for this message.
	// Otherwise content URL + embed asset become two gallery items for one GIF.
	const mediaBeforeContentUrls = media.size;
	for (const url of extractHttpUrls(content)) {
		if (isDirectMediaUrl(url) || isLikelyMediaSharePageUrl(url)) {
			redundantMediaUrls.push(url);
		}
		if (mediaBeforeContentUrls > 0) continue;
		if (!isDirectMediaUrl(url)) continue;
		upsertMedia(media, { url });
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
	const imageUrl = pickEmbedAssetUrl(image);
	if (imageUrl) {
		const dims = normalizeMediaDimensions(image?.width, image?.height);
		return {
			url: imageUrl,
			description: embed.title ?? embed.description ?? undefined,
			...dims
		};
	}

	const videoUrl = pickEmbedAssetUrl(embed.video);
	if (videoUrl) {
		const dims = normalizeMediaDimensions(embed.video?.width, embed.video?.height);
		return {
			url: videoUrl,
			description: embed.title ?? embed.description ?? undefined,
			...dims
		};
	}

	return null;
}

/**
 * Host-agnostic media unfurl detection.
 * Relies on Discord embed types + shape instead of Tenor/Giphy/Klipy allowlists.
 */
function isMediaUnfurlEmbed(embed: Embed) {
	if (embed.url?.trim() && EMBED_MEDIA_HOST_PATTERN.test(embed.url)) return false;

	const type = embed.data.type;
	if (type === EmbedType.Image || type === EmbedType.GIFV || type === EmbedType.Video) {
		return true;
	}

	// Animated unfurls often arrive as rich embeds with a video asset.
	if (embed.video) return true;

	const pageUrl = embed.url?.trim();
	// Direct CDN links Discord unfurled (e.g. media1.tenor.com/.../otter.gif).
	if (pageUrl && isDirectMediaUrl(pageUrl)) return true;

	const hasVisual = Boolean(embed.image || embed.thumbnail || embed.video);
	// Share pages like tenor.com/view/... or giphy.com/gifs/...
	if (pageUrl && hasVisual && isLikelyMediaSharePageUrl(pageUrl)) return true;

	const hasImage = Boolean(embed.image || embed.thumbnail);
	if (!hasImage) return false;

	// Article-like embeds keep text; GIF shares often only have title + short alt text.
	if (embed.fields.length > 0 || embed.author || embed.footer) return false;

	const description = embed.description?.trim() ?? '';
	return description.length <= 280;
}

/**
 * Prefer a durable/fetchable *animated* asset for relay.
 * Discord GIFV/share embeds usually expose:
 * - `image` → still poster (often `.webp` on cdn.discordapp.com)
 * - `video` → the actual animation (`.mp4`)
 * Picking the poster makes the gallery show a frozen frame.
 */
function toMediaItemFromMediaEmbed(embed: Embed): RelayMediaItem | null {
	const image = embed.image ?? embed.thumbnail;
	const video = embed.video;

	const imageAsset = pickEmbedAsset(image);
	const videoAsset = pickEmbedAsset(video);
	const primary = pickAnimatedEmbedAsset(imageAsset, videoAsset);
	if (!primary) {
		const pageUrl = embed.url?.trim();
		if (pageUrl && isDirectMediaUrl(pageUrl)) return { url: pageUrl };
		return null;
	}

	const dims = primary.fromImage
		? normalizeMediaDimensions(image?.width, image?.height)
		: normalizeMediaDimensions(video?.width ?? image?.width, video?.height ?? image?.height);

	return {
		url: primary.asset.url,
		...(primary.asset.proxyUrl ? { proxyUrl: primary.asset.proxyUrl } : {}),
		...dims
	};
}

function pickAnimatedEmbedAsset(
	imageAsset: { url: string; proxyUrl?: string } | null,
	videoAsset: { url: string; proxyUrl?: string } | null
): { asset: { url: string; proxyUrl?: string }; fromImage: boolean } | null {
	// True GIFs animate as images in Media Gallery.
	if (imageAsset && /\.gif(\?|$)/i.test(imageAsset.url)) {
		return { asset: imageAsset, fromImage: true };
	}

	// Poster webp/png + mp4 is the common GIFV shape — use the video.
	if (videoAsset) {
		return { asset: videoAsset, fromImage: false };
	}

	if (imageAsset) {
		return { asset: imageAsset, fromImage: true };
	}

	return null;
}

function pickEmbedAsset(asset: { url?: string; proxyURL?: string } | null | undefined): {
	url: string;
	proxyUrl?: string;
} | null {
	const url = asset?.url?.trim();
	const proxyUrl = asset?.proxyURL?.trim();
	if (!url && !proxyUrl) return null;

	// Signed attachment CDN links expire and break when reused on another message.
	// Prefer Discord's media proxy as the fetch source when available.
	if (url && isDiscordAttachmentCdnUrl(url) && proxyUrl) {
		return { url, proxyUrl };
	}

	return {
		url: (url ?? proxyUrl)!,
		...(proxyUrl ? { proxyUrl } : {})
	};
}

function pickEmbedAssetUrl(asset: { url?: string; proxyURL?: string } | null | undefined) {
	return pickEmbedAsset(asset)?.url ?? null;
}

/** Path shapes used by GIF/image share sites (host-agnostic). */
export function isLikelyMediaSharePageUrl(url: string) {
	try {
		const pathname = new URL(url).pathname.toLowerCase();
		return /\/(view|gifs?|gif|stickers?|clips?|media|embed)\b/.test(pathname);
	} catch {
		return false;
	}
}

function collectEmbedUrls(embed: Embed, urls: string[]) {
	const candidates = [
		embed.url,
		embed.image?.url,
		embed.image?.proxyURL,
		embed.thumbnail?.url,
		embed.thumbnail?.proxyURL,
		embed.video?.url,
		embed.video?.proxyURL
	];
	for (const candidate of candidates) {
		const trimmed = candidate?.trim();
		if (trimmed) urls.push(trimmed);
	}
}

function extractHttpUrls(text: string) {
	return [...text.matchAll(HTTP_URL_PATTERN)].map((match) => match[0]);
}

export function isDirectMediaUrl(url: string) {
	try {
		const pathname = new URL(url).pathname;
		return IMAGE_EXTENSION_PATTERN.test(pathname) || VIDEO_EXTENSION_PATTERN.test(pathname);
	} catch {
		return IMAGE_EXTENSION_PATTERN.test(url) || VIDEO_EXTENSION_PATTERN.test(url);
	}
}

/**
 * Components V2 Media Gallery is unreliable with first-seen / cross-message CDN URLs
 * (including signed `cdn.discordapp.com/attachments/…` links Discord uses when caching
 * Klipy/Tenor/… embeds). Always re-upload bytes and point the gallery at `attachment://…`.
 */
export async function materializeRelayMediaForDiscord(media?: RelayMediaItem[]): Promise<{
	media?: RelayMediaItem[];
	files?: AttachmentBuilder[];
}> {
	if (!media?.length) return {};

	const files: AttachmentBuilder[] = [];
	const next: RelayMediaItem[] = [];
	const usedNames = new Set<string>();

	for (let index = 0; index < media.length; index++) {
		const item = media[index]!;
		if (item.url.startsWith('attachment://')) {
			next.push(item);
			continue;
		}

		const downloaded = await downloadRelayMedia(item);
		if (downloaded) {
			const name = uniqueMediaFilename(item.url, downloaded.contentType, index, usedNames);
			files.push(new AttachmentBuilder(downloaded.buffer, { name }));
			next.push({ ...item, url: `attachment://${name}`, proxyUrl: undefined });
			continue;
		}

		// Last resort: Discord proxy may still render when the signed attachment URL will not.
		if (item.proxyUrl) {
			next.push({ ...item, url: item.proxyUrl, proxyUrl: undefined });
			continue;
		}

		next.push(item);
	}

	return {
		media: next,
		...(files.length > 0 ? { files } : {})
	};
}

function isDiscordAttachmentCdnUrl(url: string) {
	try {
		return DISCORD_ATTACHMENT_HOST_PATTERN.test(new URL(url).hostname);
	} catch {
		return false;
	}
}

async function downloadRelayMedia(item: RelayMediaItem): Promise<{ buffer: Buffer; contentType: string } | null> {
	// Prefer proxy first for signed Discord attachment CDN URLs (Klipy/etc. caches).
	const preferProxyFirst = isDiscordAttachmentCdnUrl(item.url);
	const ordered = preferProxyFirst
		? [item.proxyUrl, item.url]
		: [item.proxyUrl, item.url];
	const candidates = [...new Set(ordered.filter((value): value is string => Boolean(value)))];

	for (const candidate of candidates) {
		try {
			const response = await fetch(candidate, { signal: AbortSignal.timeout(15_000) });
			if (!response.ok) continue;

			const buffer = Buffer.from(await response.arrayBuffer());
			if (buffer.byteLength === 0 || buffer.byteLength > RELAY_MEDIA_REUPLOAD_MAX_BYTES) continue;

			return {
				buffer,
				contentType: response.headers.get('content-type') ?? ''
			};
		} catch {
			// try next candidate
		}
	}

	return null;
}

function uniqueMediaFilename(url: string, contentType: string, index: number, usedNames: Set<string>) {
	const base = mediaFilenameFromUrl(url, contentType, index);
	if (!usedNames.has(base)) {
		usedNames.add(base);
		return base;
	}

	const dot = base.lastIndexOf('.');
	const stem = dot > 0 ? base.slice(0, dot) : base;
	const ext = dot > 0 ? base.slice(dot) : '';
	let attempt = 2;
	let candidate = `${stem}-${attempt}${ext}`;
	while (usedNames.has(candidate)) {
		attempt += 1;
		candidate = `${stem}-${attempt}${ext}`;
	}
	usedNames.add(candidate);
	return candidate;
}

function mediaFilenameFromUrl(url: string, contentType: string, index: number) {
	try {
		const pathname = new URL(url).pathname;
		const last = pathname.split('/').filter(Boolean).at(-1);
		if (last && /\.[a-z0-9]{2,5}$/i.test(last)) {
			return sanitizeFilename(last);
		}
	} catch {
		// fall through
	}

	const ext = extensionFromContentType(contentType) ?? 'gif';
	return `relay-media-${index + 1}.${ext}`;
}

function extensionFromContentType(contentType: string) {
	const normalized = contentType.split(';')[0]?.trim().toLowerCase();
	switch (normalized) {
		case 'image/gif':
			return 'gif';
		case 'image/png':
			return 'png';
		case 'image/jpeg':
			return 'jpg';
		case 'image/webp':
			return 'webp';
		case 'video/mp4':
			return 'mp4';
		case 'video/webm':
			return 'webm';
		default:
			return null;
	}
}

function sanitizeFilename(name: string) {
	return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'relay-media.gif';
}

function stripRedundantMediaUrls(text: string, pageUrls: string[], mediaUrls: string[]) {
	if (!text) return text;

	let result = text;
	const stripExact = new Set([...pageUrls, ...mediaUrls].filter(Boolean));
	for (const url of stripExact) {
		result = result.split(url).join('');
	}

	// Drop leftover direct media URLs / share-page URLs once gallery media covers the message.
	if (mediaUrls.length > 0) {
		result = result.replace(HTTP_URL_PATTERN, (match) =>
			isDirectMediaUrl(match) || isLikelyMediaSharePageUrl(match) ? '' : match
		);
	}

	return result
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1]?.length > 0))
		.join('\n')
		.trim();
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
		proxyUrl: existing.proxyUrl ?? item.proxyUrl,
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
