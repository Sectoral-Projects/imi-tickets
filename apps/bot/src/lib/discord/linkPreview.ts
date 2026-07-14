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
		if (isYoutubeLinkPreview(preview)) {
			const markdown = youtubeMarkdownLink(preview.url);
			// Keep a readable in-place marker for the transcript (and Discord V2 body).
			result = result.split(preview.url).join(result.includes(markdown) ? '' : markdown);
			const videoId = extractYoutubeVideoId(preview.url);
			if (videoId) youtubeIds.add(videoId);
			continue;
		}

		result = result.split(preview.url).join('');
	}

	for (const videoId of youtubeIds) {
		// Skip URLs already inside `[YouTube](<...>)` so we do not nest replacements.
		result = result.replace(
			new RegExp(
				`(?<!\\]\\(<)https?:\\/\\/(?:www\\.)?(?:youtube\\.com\\/watch\\?v=${videoId}(?:&[^\\s<>]*)?|youtu\\.be\\/${videoId}(?:\\?[^\\s<>]*)?|youtube\\.com\\/shorts\\/${videoId}(?:\\?[^\\s<>]*)?)`,
				'gi'
			),
			(match) => youtubeMarkdownLink(match)
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

export function isYoutubeLinkPreview(preview: RelayLinkPreview) {
	if (preview.provider && /^youtube$/i.test(preview.provider)) return true;
	return Boolean(extractYoutubeVideoId(preview.url));
}

export function canonicalizeYoutubeWatchUrl(url: string) {
	const videoId = extractYoutubeVideoId(url);
	return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url.trim();
}

export function youtubeMarkdownLink(url: string) {
	return `[YouTube](<${canonicalizeYoutubeWatchUrl(url)}>)`;
}

const YOUTUBE_URL_IN_TEXT_PATTERN =
	/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s<>]*v=[\w-]+[^\s<>]*|shorts\/[\w-]+[^\s<>]*|embed\/[\w-]+[^\s<>]*)|youtu\.be\/[\w-]+[^\s<>]*)/gi;

/** Collect unique YouTube watch URLs from relay text + link previews. */
export function collectYoutubeWatchUrls(input: {
	text?: string;
	linkPreviews?: RelayLinkPreview[];
}): string[] {
	const byId = new Map<string, string>();

	for (const preview of input.linkPreviews ?? []) {
		if (!isYoutubeLinkPreview(preview)) continue;
		const videoId = extractYoutubeVideoId(preview.url);
		if (!videoId || byId.has(videoId)) continue;
		byId.set(videoId, canonicalizeYoutubeWatchUrl(preview.url));
	}

	const text = input.text ?? '';
	for (const match of text.matchAll(YOUTUBE_URL_IN_TEXT_PATTERN)) {
		const videoId = extractYoutubeVideoId(match[0]);
		if (!videoId || byId.has(videoId)) continue;
		byId.set(videoId, canonicalizeYoutubeWatchUrl(match[0]));
	}

	return [...byId.values()];
}

export function stripYoutubeUrlsFromText(text: string) {
	return text
		.replace(YOUTUBE_URL_IN_TEXT_PATTERN, '')
		.replace(/\[YouTube\]\(<https?:\/\/[^>]+>\)/gi, '')
		.replace(/\[YouTube\]\(https?:\/\/[^)]+\)/gi, '')
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1]?.length > 0))
		.join('\n')
		.trim();
}

export function isYoutubeOnlyText(text: string) {
	const trimmed = text.trim();
	if (!trimmed) return false;
	return stripYoutubeUrlsFromText(trimmed).length === 0 && collectYoutubeWatchUrls({ text: trimmed }).length > 0;
}

/** Replace raw YouTube URLs with embed-suppressed markdown links for Components V2 text. */
export function replaceYoutubeUrlsWithMarkdownLinks(text: string) {
	return text.replace(YOUTUBE_URL_IN_TEXT_PATTERN, (match) => youtubeMarkdownLink(match));
}

/**
 * Build Components V2 body text: turn raw YouTube URLs into `[YouTube](<url>)`,
 * and if URLs were already stripped (legacy), append those markdown links.
 */
export function buildRelayTextWithYoutubeMarkdown(text: string, youtubeUrls: string[]) {
	let result = replaceYoutubeUrlsWithMarkdownLinks(text);

	for (const url of youtubeUrls) {
		const markdown = youtubeMarkdownLink(url);
		if (result.includes(markdown) || result.includes(canonicalizeYoutubeWatchUrl(url))) continue;
		result = result.trim() ? `${result.trim()}\n${markdown}` : markdown;
	}

	return result.trim();
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
