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

/** Matches `max-h-80` on transcript media. */
export const INLINE_MEDIA_MAX_HEIGHT_PX = 320;

/**
 * Horizontal chrome between the transcript ScrollArea viewport and the message
 * content column on *lead* rows (narrower than follow-ups):
 * virtual `px-4` (32) + row `pl-4` (16) + avatar (40) + `gap-3` (12) + `pr-16` (64).
 * Use this for both `estimateSize` and locked media frames so measure ≡ estimate.
 */
export const TRANSCRIPT_MEDIA_COLUMN_CHROME_PX = 164;

/** Forwarded accent rail (`w-1` + `gap-2.5`) inside the content column. */
export const TRANSCRIPT_FORWARDED_MEDIA_INSET_PX = 14;

/** 1px border on top + bottom when dims are unknown (unlocked `h-auto` frames). */
const INLINE_MEDIA_BORDER_Y_PX = 2;

/**
 * True when Discord stored intrinsic pixel size for reserved layout.
 */
export function hasInlineMediaDimensions(attachment: Attachment) {
  return (
    typeof attachment.width === "number" &&
    typeof attachment.height === "number" &&
    Number.isFinite(attachment.width) &&
    Number.isFinite(attachment.height) &&
    attachment.width > 0 &&
    attachment.height > 0
  );
}

/**
 * object-contain size inside a maxWidth × max-h-80 box. Shared by the
 * virtualizer estimate and the locked media frame so layout never reflows.
 */
export function getInlineMediaDisplaySize(
  attachment: Attachment,
  maxWidthPx: number,
): { width: number; height: number } | null {
  if (!hasInlineMediaDimensions(attachment)) return null;

  const naturalW = attachment.width!;
  const naturalH = attachment.height!;
  const maxW = Math.max(1, maxWidthPx);
  const scale = Math.min(
    1,
    maxW / naturalW,
    INLINE_MEDIA_MAX_HEIGHT_PX / naturalH,
  );

  return {
    width: Math.max(1, Math.round(naturalW * scale)),
    height: Math.max(1, Math.round(naturalH * scale)),
  };
}

/**
 * Display height for virtualizer `estimateSize`.
 *
 * When `maxWidthPx` is provided with stored dims, this matches the locked media
 * frame exactly (no estimate→measure delta). Without a column width, fall back
 * to the max-h-80 upper bound so we still overestimate rather than undershoot.
 */
export function estimateInlineMediaHeight(
  attachment: Attachment,
  maxWidthPx?: number,
) {
  if (hasInlineMediaDimensions(attachment)) {
    const display = getInlineMediaDisplaySize(
      attachment,
      maxWidthPx ?? 10_000,
    );
    if (display) {
      // Locked frames use border-box height === display.height (border inside).
      // Unknown-width fallback still adds border for unlocked `h-auto` imgs.
      return maxWidthPx != null
        ? display.height
        : display.height + INLINE_MEDIA_BORDER_Y_PX;
    }
  }

  if (isImageMediaUrl(attachment.url)) {
    return INLINE_MEDIA_MAX_HEIGHT_PX + INLINE_MEDIA_BORDER_Y_PX;
  }
  if (isHostedVideoUrl(attachment.url)) {
    return 240 + INLINE_MEDIA_BORDER_Y_PX;
  }
  return 0;
}
