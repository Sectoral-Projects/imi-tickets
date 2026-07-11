import type { Attachment } from "../schemas/messages";

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const YOUTUBE_THUMBNAIL_HOST_PATTERN = /(?:i\.ytimg\.com|yt3\.ggpht\.com)/i;
const VEED_HOST_PATTERN = /veed\.io/i;

export function isYoutubeThumbnailUrl(url: string) {
  try {
    return YOUTUBE_THUMBNAIL_HOST_PATTERN.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function extractYoutubeVideoId(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ?? null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const queryId = parsed.searchParams.get("v");
      if (queryId) return queryId;

      const pathMatch = parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/i);
      if (pathMatch?.[1]) return pathMatch[1];
    }

    if (isYoutubeThumbnailUrl(url)) {
      const thumbnailMatch = parsed.pathname.match(/\/vi\/([^/]+)\//i);
      return thumbnailMatch?.[1] ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildYoutubeEmbedUrl(videoId: string) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function isImageMediaUrl(url: string) {
  return IMAGE_EXTENSION_PATTERN.test(url);
}

export function isHostedVideoUrl(url: string) {
  return VIDEO_EXTENSION_PATTERN.test(url);
}

export function isYoutubeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return YOUTUBE_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function isVeedUrl(url: string) {
  try {
    const parsed = new URL(url);
    return VEED_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function toYoutubeEmbedUrl(url: string) {
  const videoId = extractYoutubeVideoId(url);
  return videoId ? buildYoutubeEmbedUrl(videoId) : null;
}

export function toVeedEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("veed.io")) return null;
    if (parsed.pathname.startsWith("/embed/")) return url;
    const match = parsed.pathname.match(/\/view\/([^/]+)/i);
    return match?.[1] ? `https://www.veed.io/embed/${match[1]}` : url;
  } catch {
    return null;
  }
}

export function isEmbedVideoAttachment(attachment: Attachment) {
  if (isYoutubeUrl(attachment.url) || isVeedUrl(attachment.url)) return true;
  return isYoutubeThumbnailUrl(attachment.url) && Boolean(extractYoutubeVideoId(attachment.url));
}

export function dedupeEmbedVideoAttachments(attachments: Attachment[]) {
  const youtubeById = new Map<string, Attachment>();
  const others: Attachment[] = [];

  for (const attachment of attachments) {
    if (isVeedUrl(attachment.url)) {
      others.push(attachment);
      continue;
    }

    const videoId = extractYoutubeVideoId(attachment.url);
    if (!videoId) continue;

    const existing = youtubeById.get(videoId);
    if (!existing || isYoutubeUrl(attachment.url)) {
      youtubeById.set(videoId, attachment);
    }
  }

  return [...youtubeById.values(), ...others];
}

export function shouldRenderInlineMedia(attachment: Attachment) {
  if (isEmbedVideoAttachment(attachment)) return false;

  return (
    isImageMediaUrl(attachment.url) ||
    isHostedVideoUrl(attachment.url)
  );
}
