const DISCORD_TIMESTAMP_RE = /<t:(\d+):([fFdDtTR])>/g;
const DISCORD_SUBTEXT_PREFIX = /^-#\s+/gm;

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
  const withSubtext = content.replace(/^-#\s+(.+)$/gm, "\n\n*$1*\n\n");
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
