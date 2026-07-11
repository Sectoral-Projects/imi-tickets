import type { Attachment } from "../schemas/messages";
import { cn } from "@/lib/utils";
import { isHostedVideoUrl, isImageMediaUrl, isVeedUrl, isYoutubeUrl } from "../utils/message-media";
import { EmbedVideoPlayer } from "./embed-video-player";

type MessageMediaProps = {
  attachment: Attachment;
  className?: string;
};

export function MessageMedia({ attachment, className }: MessageMediaProps) {
  const url = attachment.url;
  const label = attachment.name ?? url;

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
          className={cn(
            "max-h-80 max-w-full rounded-md border border-border object-contain",
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
        className={cn("max-h-80 max-w-full rounded-md border border-border", className)}
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
