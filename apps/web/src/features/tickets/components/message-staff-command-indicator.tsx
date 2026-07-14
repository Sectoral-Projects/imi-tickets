import type { EnrichedMessage } from "../schemas/messages";

/** Inline marker next to the timestamp, matching `(edited)` / `(deleted)`. */
export function MessageStaffCommandIndicator({
  message,
}: {
  message: EnrichedMessage;
}) {
  const command = message.staffCommand?.trim();
  if (!command) return null;
  return (
    <span className="text-[11px] text-muted-foreground">({command})</span>
  );
}
