import twemoji from "@discordapp/twemoji";

/** Discord jumbo-emoji cap: more than this renders at normal size. */
export const DISCORD_MAX_JUMBO_EMOJIS = 27;

const CUSTOM_EMOJI_RE = /<(a?):(\w+):(\d{17,20})>/g;

export type TwemojiTextPart =
  | { type: "text"; value: string }
  | { type: "unicode"; value: string }
  | { type: "custom"; name: string; id: string; animated: boolean };

/**
 * Unicode emoji → Twemoji asset URL using Discord's published package
 * (`@discordapp/twemoji`), which pins assets to jdecked/twemoji@16.0.1.
 * Custom Discord emoji (snowflake ids) still use Discord's emoji CDN.
 */
export function twemojiSvgUrl(unicodeEmoji: string) {
  const trimmed = unicodeEmoji.trim();
  if (!trimmed) return null;

  try {
    const codePoint = twemoji.convert.toCodePoint(trimmed);
    if (!codePoint) return null;
    return `${twemoji.base}svg/${codePoint}.svg`;
  } catch {
    return null;
  }
}

export function discordCustomEmojiUrl(id: string, animated: boolean) {
  const extension = animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${id}.${extension}?size=64&quality=lossless`;
}

function splitUnicodeEmojiParts(text: string): TwemojiTextPart[] {
  if (!text) return [];

  const parts: TwemojiTextPart[] = [];
  let lastIndex = 0;

  twemoji.replace(text, (match, ...rest) => {
    const offset = rest[rest.length - 2];
    if (typeof offset !== "number") return match;

    if (offset > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, offset) });
    }
    parts.push({ type: "unicode", value: match });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

/** Split a string into plain text, unicode emoji, and Discord custom emoji. */
export function splitTwemojiParts(text: string): TwemojiTextPart[] {
  if (!text) return [];

  const parts: TwemojiTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CUSTOM_EMOJI_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(...splitUnicodeEmojiParts(text.slice(lastIndex, index)));
    }

    parts.push({
      type: "custom",
      name: match[2],
      id: match[3],
      animated: match[1] === "a",
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...splitUnicodeEmojiParts(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

function countUnicodeEmoji(text: string) {
  let count = 0;
  twemoji.replace(text, () => {
    count += 1;
    return "";
  });
  return count;
}

/**
 * Discord-style jumbo: message is only emoji (unicode and/or custom) plus
 * whitespace, and emoji count is at most {@link DISCORD_MAX_JUMBO_EMOJIS}.
 */
export function isJumboEmojiMessage(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return false;

  const customMatches = [...trimmed.matchAll(CUSTOM_EMOJI_RE)];
  const withoutCustom = trimmed.replace(CUSTOM_EMOJI_RE, "");
  const compact = withoutCustom.replace(/\s+/g, "");
  const unicodeCount = countUnicodeEmoji(compact);
  const remainder = twemoji.replace(compact, () => "");
  const total = customMatches.length + unicodeCount;

  return (
    remainder.length === 0 &&
    total > 0 &&
    total <= DISCORD_MAX_JUMBO_EMOJIS
  );
}
