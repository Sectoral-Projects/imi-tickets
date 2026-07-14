import type { AuditTimelineEntry } from "../../schemas/timeline";

const LIFECYCLE_ACTIONS = new Set([
  "thread.created",
  "thread.closed",
  "thread.reopened",
  "thread.tag.added",
  "thread.tag.removed",
  "thread.close.scheduled",
  "thread.close.schedule_cancelled",
  "participant.added",
  "participant.dms_unavailable",
  "participant.dms_available",
]);

export function isLifecycleAuditAction(action: string) {
  return LIFECYCLE_ACTIONS.has(action);
}

/** Parse `closesAt` from an audit payload (ISO string or epoch ms). */
export function resolveScheduledCloseAt(
  closesAt: string | number | null | undefined,
): number | null {
  if (closesAt == null) return null;
  if (typeof closesAt === "number" && Number.isFinite(closesAt)) return closesAt;
  if (typeof closesAt === "string" && closesAt.trim()) {
    const parsed = Date.parse(closesAt);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Live countdown for scheduled-close markers — always includes seconds. */
export function formatLiveCloseCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  if (totalSeconds <= 0) return "0s";

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function formatAuditLabel(audit: AuditTimelineEntry) {
  const payload = audit.payload ?? {};

  switch (audit.action) {
    case "thread.created":
      return "Ticket opened";
    case "thread.closed": {
      const reason =
        typeof payload.reason === "string" && payload.reason.trim()
          ? `: ${payload.reason.trim()}`
          : "";
      return `Ticket closed${reason}`;
    }
    case "thread.reopened":
      return "Ticket reopened";
    case "thread.tag.added":
      return typeof payload.tag === "string"
        ? `Tag added: ${payload.tag}`
        : "Tag added";
    case "thread.tag.removed":
      return typeof payload.tag === "string"
        ? `Tag removed: ${payload.tag}`
        : "Tag removed";
    case "thread.close.scheduled": {
      const closesAt = resolveScheduledCloseAt(
        typeof payload.closesAt === "string" || typeof payload.closesAt === "number"
          ? payload.closesAt
          : null,
      );
      if (closesAt != null) {
        return `Close Scheduled: ${formatLiveCloseCountdown(closesAt - Date.now())}`;
      }
      const duration =
        typeof payload.durationLabel === "string" && payload.durationLabel.trim()
          ? payload.durationLabel.trim()
          : "soon";
      return `Close Scheduled: ${duration}`;
    }
    case "thread.close.schedule_cancelled":
      return "Close Schedule Cancelled";
    case "participant.added":
      return payload.dmUnreachable === true
        ? "Member added: DMs unavailable"
        : "Member added";
    case "participant.dms_unavailable":
      return "DMs unavailable";
    case "participant.dms_available":
      return "DMs available";
    default:
      return audit.action;
  }
}
