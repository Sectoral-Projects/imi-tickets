import type { Attachment } from "../schemas/messages";
import { cn } from "@/lib/utils";
import { EmbedVideoPlayer } from "./embed-video-player";
import { isVeedUrl, isYoutubeUrl } from "../utils/message-media";

type LinkPreviewCardProps = {
  attachment: Attachment;
  className?: string;
};

function parseLinkPreviewLabel(name: string | null) {
  if (!name) return { provider: undefined, author: undefined, title: undefined };

  const parts = name.split(" · ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { provider: parts[0], author: parts[1], title: parts.slice(2).join(" · ") };
  }
  if (parts.length === 2) {
    return { provider: parts[0], author: undefined, title: parts[1] };
  }

  return { provider: undefined, author: undefined, title: parts[0] };
}

export function LinkPreviewCard({ attachment, className }: LinkPreviewCardProps) {
  const url = attachment.url;
  const { provider, author, title } = parseLinkPreviewLabel(attachment.name);
  const isYoutube = isYoutubeUrl(url);
  const isVeed = isVeedUrl(url);
  const resolvedTitle = title ?? attachment.name ?? "Embedded video";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 overflow-hidden rounded-md border border-border bg-muted/20 p-3",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-1 border-l-4 pl-3",
          isYoutube ? "border-destructive" : isVeed ? "border-primary" : "border-border",
        )}
      >
        {provider ? <p className="text-xs text-muted-foreground">{provider}</p> : null}
        {author ? <p className="text-sm font-semibold">{author}</p> : null}
        {title ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline"
            onClick={(event) => event.stopPropagation()}
          >
            {title}
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline break-all"
            onClick={(event) => event.stopPropagation()}
          >
            {url}
          </a>
        )}
      </div>

      <EmbedVideoPlayer url={url} title={resolvedTitle} />
    </div>
  );
}
