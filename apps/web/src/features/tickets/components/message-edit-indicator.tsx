import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EnrichedMessage, MessageRevision } from "../schemas/messages";
import { MessageMarkdown } from "./message-markdown";

function formatRevisionLabel(revision: number, index: number) {
  if (index === 0) return "Original";
  return `Edit ${revision - 1}`;
}

function formatRevisionTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageEditIndicator({ message }: { message: EnrichedMessage }) {
  const wasEdited = message.revision > 1 || message.updatedAt !== null;
  if (!wasEdited) return null;

  const history = message.editHistory ?? [];
  const hasHistory = history.length > 0;

  if (!hasHistory) {
    return <span className="text-[11px] text-muted-foreground">(edited)</span>;
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        (edited)
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(22rem,90vw)] gap-3"
        side="top"
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle>Edit history</PopoverTitle>
        </PopoverHeader>
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {history.map((revision: MessageRevision, index: number) => (
            <div key={revision.revision} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                <span>{formatRevisionLabel(revision.revision, index)}</span>
                <span className="normal-case">{formatRevisionTime(revision.editedAt)}</span>
              </div>
              <div className="rounded-md bg-muted/50 p-2.5 text-xs leading-relaxed">
                <MessageMarkdown content={revision.content} />
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
