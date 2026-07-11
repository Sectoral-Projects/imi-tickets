import type { AuditTimelineEntry } from "../../schemas/timeline";

const LIFECYCLE_ACTIONS = new Set([
  "thread.created",
  "thread.closed",
  "thread.reopened",
  "thread.tag.added",
  "thread.tag.removed",
]);

export function isLifecycleAuditAction(action: string) {
  return LIFECYCLE_ACTIONS.has(action);
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
    default:
      return audit.action;
  }
}
