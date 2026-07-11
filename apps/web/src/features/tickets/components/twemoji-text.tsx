import { cn } from "@/lib/utils";
import {
  discordCustomEmojiUrl,
  splitTwemojiParts,
  twemojiSvgUrl,
  type TwemojiTextPart,
} from "@/lib/twemoji";

function TwemojiImage({
  src,
  alt,
  jumbo,
}: {
  src: string;
  alt: string;
  jumbo: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading="lazy"
      className={cn(
        "emoji inline-block object-contain",
        jumbo
          ? "mx-0.5 size-12 align-middle"
          : "mx-[0.05em] h-[1.375em] w-[1.375em] align-[-0.2em]",
      )}
    />
  );
}

function renderPart(part: TwemojiTextPart, jumbo: boolean, key: number) {
  if (part.type === "text") {
    return part.value ? <span key={key}>{part.value}</span> : null;
  }

  if (part.type === "custom") {
    return (
      <TwemojiImage
        key={key}
        src={discordCustomEmojiUrl(part.id, part.animated)}
        alt={part.name}
        jumbo={jumbo}
      />
    );
  }

  const src = twemojiSvgUrl(part.value);
  if (!src) {
    return (
      <span key={key} className={jumbo ? "text-5xl leading-none" : undefined}>
        {part.value}
      </span>
    );
  }

  return (
    <TwemojiImage key={key} src={src} alt={part.value} jumbo={jumbo} />
  );
}

/** Render a string with Twemoji (+ Discord custom emoji tags). */
export function TwemojiText({
  text,
  jumbo = false,
}: {
  text: string;
  jumbo?: boolean;
}) {
  const parts = splitTwemojiParts(text);
  if (parts.length === 1 && parts[0]?.type === "text") {
    return <>{parts[0].value}</>;
  }

  return <>{parts.map((part, index) => renderPart(part, jumbo, index))}</>;
}
