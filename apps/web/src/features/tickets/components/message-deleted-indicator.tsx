import type { EnrichedMessage } from "../schemas/messages";

/** Inline marker next to the timestamp, matching `(edited)`. */
export function MessageDeletedIndicator({ message }: { message: EnrichedMessage }) {
  if (!message.deletedAt) return null;
  return <span className="text-[11px] text-muted-foreground">(deleted)</span>;
}
