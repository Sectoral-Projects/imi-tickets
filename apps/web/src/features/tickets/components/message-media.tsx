import type { Attachment } from "../schemas/messages";
import { cn } from "@/lib/utils";
import {
  getInlineMediaDisplaySize,
  hasInlineMediaDimensions,
  isHostedVideoUrl,
  isImageMediaUrl,
  isVeedUrl,
  isYoutubeUrl,
} from "../utils/message-media";
import { EmbedVideoPlayer } from "./embed-video-player";

type MessageMediaProps = {
  attachment: Attachment;
  className?: string;
  /** Content-column max width — must match virtualizer estimate input. */
  maxWidthPx?: number;
};

export function MessageMedia({
  attachment,
  className,
  maxWidthPx,
}: MessageMediaProps) {
  const url = attachment.url;
  const label = attachment.name ?? url;
  const hasDims = hasInlineMediaDimensions(attachment);
  const display =
    hasDims && maxWidthPx != null
      ? getInlineMediaDisplaySize(attachment, maxWidthPx)
      : null;

  if (isImageMediaUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn("block", className)}
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={url}
          alt={label}
          width={display?.width ?? (hasDims ? attachment.width! : undefined)}
          height={display?.height ?? (hasDims ? attachment.height! : undefined)}
          style={
            display
              ? { width: display.width, height: display.height }
              : undefined
          }
          className={cn(
            "rounded-md border border-border object-contain",
            display
              ? "max-w-full"
              : "h-auto max-h-80 max-w-full",
            attachment.isSpoiler && "blur-sm hover:blur-none",
          )}
        />
      </a>
    );
  }

  if (isYoutubeUrl(url) || isVeedUrl(url)) {
    return <EmbedVideoPlayer url={url} title={label} className={className} />;
  }

  if (isHostedVideoUrl(url)) {
    return (
      <video
        src={url}
        controls
        width={display?.width ?? (hasDims ? attachment.width! : undefined)}
        height={display?.height ?? (hasDims ? attachment.height! : undefined)}
        style={
          display
            ? { width: display.width, height: display.height }
            : undefined
        }
        className={cn(
          "rounded-md border border-border",
          display ? "max-w-full object-contain" : "h-auto max-h-80 max-w-full",
          className,
        )}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-primary underline"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
}
