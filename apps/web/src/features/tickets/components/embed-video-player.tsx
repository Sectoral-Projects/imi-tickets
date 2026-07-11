import { cn } from "@/lib/utils";
import { isVeedUrl, isYoutubeUrl, toVeedEmbedUrl, toYoutubeEmbedUrl } from "../utils/message-media";

type EmbedVideoPlayerProps = {
  url: string;
  title?: string;
  className?: string;
};

export function EmbedVideoPlayer({ url, title, className }: EmbedVideoPlayerProps) {
  const embedUrl = isYoutubeUrl(url)
    ? toYoutubeEmbedUrl(url)
    : isVeedUrl(url)
      ? toVeedEmbedUrl(url)
      : null;

  if (!embedUrl) return null;

  return (
    <div className={cn("w-full max-w-2xl overflow-hidden rounded-md border border-border bg-black", className)}>
      <div className="relative aspect-video w-full">
        <iframe
          src={embedUrl}
          title={title ?? "Embedded video"}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
