const DISCORD_TIMESTAMP_RE = /<t:(\d+):([fFdDtTR])>/g;
const DISCORD_USER_MENTION_RE = /<@!?(\d{17,20})>/g;
const DISCORD_ROLE_MENTION_RE = /<@&(\d{17,20})>/g;
const DISCORD_CUSTOM_EMOJI_RE = /<(a?):(\w+):(\d{17,20})>/g;
const DISCORD_SUBTEXT_PREFIX = /^-#\s+/gm;

/** Discord profile URL used for hoverable user mentions in transcripts. */
export function discordUserMarkdownUrl(userId: string) {
  return `https://discord.com/users/${userId}`;
}

export function parseDiscordUserIdFromHref(href: string | undefined | null) {
  if (!href) return null;
  const match = href.match(
    /^https?:\/\/(?:www\.)?discord(?:app)?\.com\/users\/(\d{17,20})\/?$/i,
  );
  return match?.[1] ?? null;
}

function formatDiscordTimestamp(seconds: number, style: string) {
  const date = new Date(seconds * 1000);
  switch (style) {
    case "t":
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    case "T":
      return date.toLocaleTimeString();
    case "d":
      return date.toLocaleDateString();
    case "D":
      return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "R":
      return date.toLocaleString();
    case "f":
    default:
      return date.toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  }
}

function replaceDiscordTimestamps(content: string, replacer: (formatted: string) => string) {
  return content.replace(DISCORD_TIMESTAMP_RE, (_, seconds: string, style: string) =>
    replacer(formatDiscordTimestamp(Number(seconds), style)),
  );
}

/** Normalize Discord-specific markdown before rendering in the ticket transcript. */
export function preprocessMessageMarkdown(content: string) {
  const withUserMentions = content.replace(
    DISCORD_USER_MENTION_RE,
    (_, userId: string) => `[User](${discordUserMarkdownUrl(userId)})`,
  );
  const withRoleMentions = withUserMentions.replace(
    DISCORD_ROLE_MENTION_RE,
    "Role",
  );
  // Turn custom emoji tags into markdown images so remark does not treat `<...>`
  // as HTML. MessageMarkdown styles these as Twemoji-sized (or jumbo) glyphs.
  const withCustomEmoji = withRoleMentions.replace(
    DISCORD_CUSTOM_EMOJI_RE,
    (_, animated: string, name: string, id: string) => {
      const extension = animated === "a" ? "gif" : "webp";
      const url = `https://cdn.discordapp.com/emojis/${id}.${extension}?size=64&quality=lossless`;
      return `![${name}](${url})`;
    },
  );
  const withSubtext = withCustomEmoji.replace(/^-#\s+(.+)$/gm, "\n\n*$1*\n\n");
  return replaceDiscordTimestamps(withSubtext, (formatted) => formatted).trim();
}

/** Plain-text copy variant — strips markdown syntax and resolves Discord timestamps. */
export function stripMarkdown(content: string) {
  let text = replaceDiscordTimestamps(content, (formatted) => formatted);
  text = text.replace(DISCORD_SUBTEXT_PREFIX, "");

  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim(),
  );
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
