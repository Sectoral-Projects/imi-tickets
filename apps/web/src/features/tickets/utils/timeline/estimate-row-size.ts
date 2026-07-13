import type { Attachment, EnrichedMessage } from "../../schemas/messages";
import { isJumboEmojiMessage } from "@/lib/twemoji";
import { preprocessMessageMarkdown } from "../messages/markdown";
import {
  dedupeEmbedVideoAttachments,
  estimateInlineMediaHeight,
  isEmbedVideoAttachment,
  shouldRenderInlineMedia,
  TRANSCRIPT_FORWARDED_MEDIA_INSET_PX,
  TRANSCRIPT_MEDIA_COLUMN_CHROME_PX,
  INLINE_MEDIA_MAX_HEIGHT_PX,
} from "../message-media";
import type { MessageGroupPos, TimelineBlock } from "./blocks";

/** Follow-up rows: wrapper px-4 (32) + row pl-4/pr-3 (28) + timestamp col (48) + gap-1 (4). */
export const TRANSCRIPT_FOLLOW_MEDIA_COLUMN_CHROME_PX = 112;

const TEXT_LINE_HEIGHT_PX = 23; // text-sm + leading-relaxed
const TEXT_CHAR_WIDTH_PX = 7.2;
const PARAGRAPH_GAP_PX = 8; // mb-2
const CODE_LINE_HEIGHT_PX = 18;
const CODE_BLOCK_PAD_PX = 16; // pre p-2
const HEADING_LINE_HEIGHT_PX = 26;
const HEADING_MARGIN_PX = 12; // mt-2 mb-1
const HR_HEIGHT_PX = 24; // my-3
const JUMBO_EMOJI_SIZE_PX = 48;
const JUMBO_EMOJI_SLOT_PX = 52;
const REPLY_HEIGHT_PX = 24; // snippet 20 + pb-1
const HEADER_LINE_PX = 20;
const BODY_MT_PX = 4; // mt-1
const REACTION_MT_PX = 4;
const REACTION_ROW_PX = 26;
const REACTION_CHIP_WIDTH_PX = 56;
const FORWARDED_LABEL_PX = 22; // label ~16 + gap-1.5
const SECTION_GAP_PX = 8; // mt-2 between body sections
const FILE_LINK_PX = 20;
const ESTIMATE_PAD_PX = 1; // tiny residual for rounding / subpixel layout
const GROUP_CARD_BORDER_PX = 2; // MessageGroupShell / ticket-message-row border
const OUTER_GROUP_GAP_PX = 16; // virtual row pb-4 between groups
const AUDIT_ROW_PX = 44;
const EMBED_CARD_PAD_Y_PX = 24; // p-3
const EMBED_META_GAP_PX = 8; // gap-2 before player
const EMBED_MAX_WIDTH_PX = 672; // max-w-2xl
const DISCORD_EMOJI_IMG_RE =
  /!\[[^\]]*\]\(https:\/\/cdn\.discordapp\.com\/emojis\/[^)]+\)/gi;
const MARKDOWN_IMG_RE = /!\[[^\]]*\]\(([^)]+)\)/gi;
const CUSTOM_EMOJI_RE = /<(a?):(\w+):(\d{17,20})>/g;

export function contentColumnMaxWidth(
  viewportWidthPx: number,
  groupPos: MessageGroupPos,
) {
  const isLead = groupPos === "solo" || groupPos === "start";
  const chrome = isLead
    ? TRANSCRIPT_MEDIA_COLUMN_CHROME_PX
    : TRANSCRIPT_FOLLOW_MEDIA_COLUMN_CHROME_PX;
  return Math.max(160, Math.floor(viewportWidthPx - chrome));
}

/** Convert lead-column max width (viewport - 164) into the width for a given group position. */
export function mediaMaxWidthForGroupPos(
  leadColumnMaxWidth: number,
  groupPos: MessageGroupPos,
) {
  const isLead = groupPos === "solo" || groupPos === "start";
  if (isLead) return leadColumnMaxWidth;
  return (
    leadColumnMaxWidth +
    (TRANSCRIPT_MEDIA_COLUMN_CHROME_PX - TRANSCRIPT_FOLLOW_MEDIA_COLUMN_CHROME_PX)
  );
}

function countMessageEmojis(content: string) {
  const trimmed = content.trim();
  const customMatches = [...trimmed.matchAll(CUSTOM_EMOJI_RE)];
  const withoutCustom = trimmed.replace(CUSTOM_EMOJI_RE, "");
  const compact = withoutCustom.replace(/\s+/g, "");
  // Approximate unicode emoji count via surrogate / emoji presentation chars.
  const unicodeMatches = compact.match(/\p{Extended_Pictographic}/gu);
  return customMatches.length + (unicodeMatches?.length ?? 0);
}

function charsPerLine(columnWidthPx: number) {
  return Math.max(18, Math.floor(columnWidthPx / TEXT_CHAR_WIDTH_PX));
}

function wrapLineCount(text: string, cpl: number) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / cpl));
}

/**
 * Approximate rendered markdown height for transcript MessageMarkdown.
 * Prefers a slight overestimate so virtualizer corrections shrink rather than grow.
 */
export function estimateMarkdownTextHeight(
  content: string,
  columnWidthPx: number,
) {
  if (!content.trim()) return 0;

  if (isJumboEmojiMessage(content)) {
    const count = Math.max(1, countMessageEmojis(content));
    const perRow = Math.max(1, Math.floor(columnWidthPx / JUMBO_EMOJI_SLOT_PX));
    return Math.ceil(count / perRow) * JUMBO_EMOJI_SIZE_PX;
  }

  const md = preprocessMessageMarkdown(content);
  const cpl = charsPerLine(columnWidthPx);
  let height = 0;

  // Non-emoji markdown images render as max-h-80 block images.
  for (const match of md.matchAll(MARKDOWN_IMG_RE)) {
    const url = match[1] ?? "";
    if (/cdn\.discordapp\.com\/emojis\//i.test(url)) continue;
    height += INLINE_MEDIA_MAX_HEIGHT_PX + SECTION_GAP_PX;
  }

  let remaining = md.replace(MARKDOWN_IMG_RE, (_full, url: string) =>
    /cdn\.discordapp\.com\/emojis\//i.test(url) ? "EE" : "",
  );

  remaining = remaining.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block
      .replace(/^```[^\n]*\n?/, "")
      .replace(/```$/, "")
      .trimEnd();
    const lines = Math.max(1, inner.length === 0 ? 1 : inner.split("\n").length);
    height += lines * CODE_LINE_HEIGHT_PX + CODE_BLOCK_PAD_PX + PARAGRAPH_GAP_PX;
    return "\n\n";
  });

  remaining = remaining.replace(/^#{1,3}\s+(.+)$/gm, (_, text: string) => {
    height +=
      wrapLineCount(String(text), cpl) * HEADING_LINE_HEIGHT_PX +
      HEADING_MARGIN_PX;
    return "\n\n";
  });

  remaining = remaining.replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, () => {
    height += HR_HEIGHT_PX;
    return "\n\n";
  });

  // Inline custom-emoji markdown images → two-char wide tokens (already EE above
  // for emoji CDN; DISCORD_EMOJI_IMG_RE covers any leftovers).
  remaining = remaining.replace(DISCORD_EMOJI_IMG_RE, "EE");

  const paragraphs = remaining
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!;
    const lines = para.split("\n");
    let visualLines = 0;

    for (const rawLine of lines) {
      const listMatch = rawLine.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
      const quoteMatch = rawLine.match(/^>\s?(.*)$/);
      let text = listMatch?.[1] ?? quoteMatch?.[1] ?? rawLine;
      // Strip remaining markdown emphasis / links for width counting.
      text = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_~`]/g, "");
      visualLines += Math.max(1, wrapLineCount(text, cpl));
      if (listMatch) visualLines += 0.15; // space-y-1 fudge as fraction of line
    }

    height += Math.ceil(visualLines) * TEXT_LINE_HEIGHT_PX;
    if (i < paragraphs.length - 1) height += PARAGRAPH_GAP_PX;
  }

  return Math.max(TEXT_LINE_HEIGHT_PX, height);
}

function estimateEmbedCardHeight(
  attachment: Attachment,
  columnWidthPx: number,
) {
  const parts = (attachment.name ?? "")
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  const metaLines = Math.min(3, Math.max(1, parts.length || 1));
  const metaH = metaLines === 3 ? 56 : metaLines === 2 ? 36 : 18;
  const embedW = Math.min(Math.max(1, columnWidthPx - EMBED_CARD_PAD_Y_PX), EMBED_MAX_WIDTH_PX);
  const embedH = Math.round(embedW * (9 / 16)) + 2;
  return EMBED_CARD_PAD_Y_PX + metaH + EMBED_META_GAP_PX + embedH;
}

function estimateMessageBodyHeight(
  message: EnrichedMessage,
  columnWidthPx: number,
) {
  const mediaWidth = message.isForwarded
    ? Math.max(1, columnWidthPx - TRANSCRIPT_FORWARDED_MEDIA_INSET_PX)
    : columnWidthPx;

  let height = estimateMarkdownTextHeight(message.content, columnWidthPx);
  const embedVideos = dedupeEmbedVideoAttachments(
    message.attachments.filter(isEmbedVideoAttachment),
  );
  const inlineMedia = message.attachments.filter(
    (attachment) =>
      shouldRenderInlineMedia(attachment) &&
      !isEmbedVideoAttachment(attachment),
  );
  const files = message.attachments.filter(
    (attachment) =>
      !shouldRenderInlineMedia(attachment) &&
      !isEmbedVideoAttachment(attachment),
  );

  const appendSection = (sectionHeight: number) => {
    if (sectionHeight <= 0) return;
    if (height > 0) height += SECTION_GAP_PX;
    height += sectionHeight;
  };

  if (embedVideos.length > 0) {
    const embedsHeight = embedVideos.reduce((total, attachment, index) => {
      return (
        total +
        estimateEmbedCardHeight(attachment, mediaWidth) +
        (index > 0 ? SECTION_GAP_PX : 0)
      );
    }, 0);
    appendSection(embedsHeight);
  }

  appendSection(
    inlineMedia.reduce((total, attachment) => {
      return total + estimateInlineMediaHeight(attachment, mediaWidth);
    }, 0) + Math.max(0, inlineMedia.length - 1) * SECTION_GAP_PX,
  );
  appendSection(
    files.length * FILE_LINK_PX + Math.max(0, files.length - 1) * 4,
  );

  if (message.isForwarded && height > 0) height += FORWARDED_LABEL_PX;
  return height;
}

function estimateReactionHeight(
  reactionCount: number,
  columnWidthPx: number,
) {
  if (reactionCount <= 0) return 0;
  const chipsPerRow = Math.max(1, Math.floor(columnWidthPx / REACTION_CHIP_WIDTH_PX));
  const rows = Math.ceil(reactionCount / chipsPerRow);
  return REACTION_MT_PX + rows * REACTION_ROW_PX;
}

function messageGroupPos(index: number, count: number): MessageGroupPos {
  if (count === 1) return "solo";
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "middle";
}

/** Height of one message inside a group card (no outer inter-group gap). */
function estimateMessageInGroupSize(
  message: EnrichedMessage,
  groupPos: MessageGroupPos,
  leadColumnMaxWidth: number,
) {
  const isLead = groupPos === "solo" || groupPos === "start";
  const columnWidth = mediaMaxWidthForGroupPos(leadColumnMaxWidth, groupPos);
  const bodyHeight = estimateMessageBodyHeight(message, columnWidth);
  const replyHeight = message.replyTo ? REPLY_HEIGHT_PX : 0;
  const reactionHeight = estimateReactionHeight(
    message.reactions.length,
    columnWidth,
  );

  if (isLead) {
    const contentColumnHeight =
      replyHeight + HEADER_LINE_PX + BODY_MT_PX + bodyHeight + reactionHeight;
    const avatarColumnHeight = message.replyTo ? 60 : 40;
    const verticalPadding = groupPos === "solo" ? 32 : 20;
    return verticalPadding + Math.max(contentColumnHeight, avatarColumnHeight);
  }

  const verticalPadding = groupPos === "end" ? 20 : 8;
  return verticalPadding + replyHeight + bodyHeight + reactionHeight;
}

/** One virtualizer item = one timeline block (message group or audit). */
export function estimateTimelineBlockSize(
  block: TimelineBlock,
  leadColumnMaxWidth: number,
) {
  if (block.kind === "audit") {
    return AUDIT_ROW_PX + OUTER_GROUP_GAP_PX + ESTIMATE_PAD_PX;
  }

  let total = 0;
  for (let index = 0; index < block.messages.length; index += 1) {
    const message = block.messages[index]!;
    total += estimateMessageInGroupSize(
      message,
      messageGroupPos(index, block.messages.length),
      leadColumnMaxWidth,
    );
  }

  return (
    total + GROUP_CARD_BORDER_PX + OUTER_GROUP_GAP_PX + ESTIMATE_PAD_PX
  );
}
