import { useEffect, useState } from "react";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  formatLiveCloseCountdown,
  resolveScheduledCloseAt,
} from "../utils/timeline/audit";
import type { TimelineAuditBlock } from "../utils/timeline/blocks";
import { UserMentionLink } from "./user-mention-link";

export function TimelineAuditMarker({ block }: { block: TimelineAuditBlock }) {
  const closesAtMs =
    block.action === "thread.close.scheduled"
      ? resolveScheduledCloseAt(block.closesAt)
      : null;

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (closesAtMs == null) return;

    const tick = () => setNowMs(Date.now());
    tick();

    // Align to the next whole second so the countdown stays in sync with the clock.
    const delay = 1000 - (Date.now() % 1000);
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 1000);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [closesAtMs]);

  if (block.action === "participant.added" && block.userId) {
    return (
      <Marker variant="separator">
        <MarkerContent>
          <UserMentionLink userId={block.userId}>{block.userId}</UserMentionLink>
          {" added"}
          {block.dmUnreachable ? ": DMs unavailable" : null}
        </MarkerContent>
      </Marker>
    );
  }

  if (
    (block.action === "participant.dms_unavailable" ||
      block.action === "participant.dms_available") &&
    block.userId
  ) {
    return (
      <Marker variant="separator">
        <MarkerContent>
          <UserMentionLink userId={block.userId}>{block.userId}</UserMentionLink>
          {block.action === "participant.dms_unavailable"
            ? ": DMs unavailable"
            : ": DMs available"}
        </MarkerContent>
      </Marker>
    );
  }

  const label =
    closesAtMs != null
      ? `Close Scheduled: ${formatLiveCloseCountdown(closesAtMs - nowMs)}`
      : block.label;

  return (
    <Marker variant="separator">
      <MarkerContent>{label}</MarkerContent>
    </Marker>
  );
}
