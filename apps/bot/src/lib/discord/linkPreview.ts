import type { Embed } from 'discord.js';

export type RelayLinkPreview = {
	/** Page URL used for links and the Open button. */
	url: string;
	/** Direct media asset URL for Media Gallery unfurling (not a watch/page URL). */
	mediaUrl?: string;
	provider?: string;
	author?: string;
	title?: string;
	thumbnailUrl?: string;
	accentColor?: number;
};

const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const YOUTUBE_THUMBNAIL_HOST_PATTERN = /(?:i\.ytimg\.com|yt3\.ggpht\.com)/i;
const VEED_HOST_PATTERN = /veed\.io/i;
const LINK_PREVIEW_URL_PATTERN =
	/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+[^\s]*|youtu\.be\/[\w-]+[^\s]*|veed\.io\/[^\s]+)/gi;

const YOUTUBE_ACCENT = 0xff_00_00;

export function isLinkPreviewUrl(url: string) {
	try {
		const parsed = new URL(url);
		return YOUTUBE_HOST_PATTERN.test(parsed.hostname) || VEED_HOST_PATTERN.test(parsed.hostname);
	} catch {
		return false;
	}
}

export function isYoutubeThumbnailUrl(url: string) {
	try {
		return YOUTUBE_THUMBNAIL_HOST_PATTERN.test(new URL(url).hostname);
	} catch {
		return false;
	}
}

export function toLinkPreviewFromEmbed(embed: Embed): RelayLinkPreview | null {
	const url = embed.url?.trim();
	if (!url || !isLinkPreviewUrl(url)) return null;

	const isYoutube = YOUTUBE_HOST_PATTERN.test(url);

	return {
		url,
		mediaUrl: resolveEmbedMediaUrl(embed, url),
		provider: embed.provider?.name ?? (isYoutube ? 'YouTube' : 'VEED.IO'),
		author: embed.author?.name ?? undefined,
		title: embed.title ?? undefined,
		thumbnailUrl: embed.thumbnail?.url ?? embed.image?.url ?? undefined,
		accentColor: isYoutube ? YOUTUBE_ACCENT : undefined
	};
}

export function toLinkPreviewFromUrl(url: string): RelayLinkPreview | null {
	const trimmed = url.trim();
	if (!isLinkPreviewUrl(trimmed)) return null;

	const isYoutube = YOUTUBE_HOST_PATTERN.test(trimmed);
	const videoId = extractYoutubeVideoId(trimmed);

	return {
		url: trimmed,
		mediaUrl: videoId ? youtubeThumbnailUrl(videoId) : undefined,
		provider: isYoutube ? 'YouTube' : 'VEED.IO',
		accentColor: isYoutube ? YOUTUBE_ACCENT : undefined
	};
}

export function extractLinkPreviewsFromText(text: string) {
	const previews: RelayLinkPreview[] = [];
	const seen = new Set<string>();

	for (const match of text.matchAll(LINK_PREVIEW_URL_PATTERN)) {
		const preview = toLinkPreviewFromUrl(match[0]);
		if (!preview) continue;
		const key = linkPreviewMergeKey(preview.url);
		if (seen.has(key)) continue;
		seen.add(key);
		previews.push(preview);
	}

	return previews;
}

export function stripLinkPreviewUrls(text: string, previews: RelayLinkPreview[]) {
	let result = text;
	const youtubeIds = new Set<string>();

	for (const preview of previews) {
		result = result.split(preview.url).join('');
		const videoId = extractYoutubeVideoId(preview.url);
		if (videoId) youtubeIds.add(videoId);
	}

	for (const videoId of youtubeIds) {
		result = result.replace(
			new RegExp(
				`https?:\\/\\/(?:www\\.)?(?:youtube\\.com\\/watch\\?v=${videoId}(?:&[^\\s]*)?|youtu\\.be\\/${videoId}(?:\\?[^\\s]*)?)`,
				'gi'
			),
			''
		);
	}

	return result
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1]?.length > 0))
		.join('\n')
		.trim();
}

export function mergeLinkPreviews(...groups: RelayLinkPreview[][]) {
	const merged = new Map<string, RelayLinkPreview>();

	for (const group of groups) {
		for (const preview of group) {
			const key = linkPreviewMergeKey(preview.url);
			const existing = merged.get(key);
			merged.set(
				key,
				existing
					? {
							...existing,
							...preview,
							url: preferLinkPreviewUrl(existing.url, preview.url),
							mediaUrl: preview.mediaUrl ?? existing.mediaUrl,
							thumbnailUrl: preview.thumbnailUrl ?? existing.thumbnailUrl
						}
					: preview
			);
		}
	}

	return [...merged.values()];
}

export function linkPreviewAttachmentName(preview: RelayLinkPreview) {
	return [preview.provider, preview.author, preview.title].filter(Boolean).join(' · ') || preview.url;
}

function resolveEmbedMediaUrl(embed: Embed, pageUrl: string) {
	if (YOUTUBE_HOST_PATTERN.test(pageUrl)) {
		const imageUrl = embed.image?.url ?? embed.thumbnail?.url;
		if (imageUrl) return normalizeYoutubeThumbnailUrl(imageUrl);

		const videoId = extractYoutubeVideoId(pageUrl);
		return videoId ? youtubeThumbnailUrl(videoId) : undefined;
	}

	const videoUrl = embed.video?.url?.trim();
	if (videoUrl && !isLinkWatchPageUrl(videoUrl)) {
		return videoUrl;
	}

	const imageUrl = embed.image?.url ?? embed.thumbnail?.url;
	if (imageUrl) return imageUrl;

	if (VEED_HOST_PATTERN.test(pageUrl)) {
		return toVeedEmbedUrl(pageUrl) ?? undefined;
	}

	return undefined;
}

export function resolveLinkPreviewMediaUrl(preview: RelayLinkPreview) {
	if (preview.thumbnailUrl) {
		return normalizeYoutubeThumbnailUrl(preview.thumbnailUrl);
	}

	if (preview.mediaUrl && isYoutubeThumbnailUrl(preview.mediaUrl)) {
		return normalizeYoutubeThumbnailUrl(preview.mediaUrl);
	}

	const videoId = extractYoutubeVideoId(preview.url);
	if (videoId) {
		return youtubeThumbnailUrl(videoId);
	}

	if (preview.mediaUrl && !isYoutubePageOrEmbedUrl(preview.mediaUrl)) {
		return preview.mediaUrl;
	}

	return undefined;
}

function isYoutubePageOrEmbedUrl(url: string) {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.includes('youtube.com') && parsed.hostname !== 'youtu.be') return false;
		return (
			parsed.hostname === 'youtu.be' ||
			parsed.pathname === '/watch' ||
			parsed.pathname.startsWith('/embed/') ||
			parsed.pathname.startsWith('/shorts/')
		);
	} catch {
		return false;
	}
}

export function extractYoutubeVideoId(url: string) {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === 'youtu.be') {
			const id = parsed.pathname.slice(1).split('/')[0];
			return id || null;
		}

		if (parsed.hostname.includes('youtube.com')) {
			if (parsed.pathname.startsWith('/embed/')) {
				return parsed.pathname.split('/')[2] ?? null;
			}
			if (parsed.pathname.startsWith('/shorts/')) {
				return parsed.pathname.split('/')[2] ?? null;
			}
			return parsed.searchParams.get('v');
		}
	} catch {
		return null;
	}

	return null;
}

function linkPreviewMergeKey(url: string) {
	const youtubeId = extractYoutubeVideoId(url);
	if (youtubeId) return `youtube:${youtubeId}`;

	try {
		const parsed = new URL(url);
		if (parsed.hostname.includes('veed.io')) {
			const embedMatch = parsed.pathname.match(/\/embed\/([^/]+)/i);
			if (embedMatch?.[1]) return `veed:${embedMatch[1]}`;
			const viewMatch = parsed.pathname.match(/\/view\/([^/]+)/i);
			if (viewMatch?.[1]) return `veed:${viewMatch[1]}`;
		}
	} catch {
		return url;
	}

	return url;
}

function preferLinkPreviewUrl(existing: string, incoming: string) {
	const existingId = extractYoutubeVideoId(existing);
	const incomingId = extractYoutubeVideoId(incoming);
	if (existingId && incomingId && existingId === incomingId) {
		return incoming.includes('youtube.com/watch') ? incoming : existing.includes('youtube.com/watch') ? existing : incoming;
	}

	return incoming.length >= existing.length ? incoming : existing;
}

function normalizeYoutubeThumbnailUrl(url: string) {
	if (!isYoutubeThumbnailUrl(url)) return url;

	const match = url.match(/\/vi\/([\w-]+)\//i);
	return match?.[1] ? youtubeThumbnailUrl(match[1]) : url;
}

function youtubeThumbnailUrl(videoId: string) {
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function isLinkWatchPageUrl(url: string) {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === 'youtu.be') return true;
		if (parsed.hostname.includes('youtube.com')) {
			return parsed.pathname === '/watch' || parsed.pathname.startsWith('/shorts/');
		}
		if (parsed.hostname.includes('veed.io')) {
			return !parsed.pathname.startsWith('/embed/');
		}
	} catch {
		return false;
	}

	return false;
}

function toVeedEmbedUrl(url: string) {
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
