import type { DateRange } from "react-day-picker";
import type { StaffActionFilter } from "../schemas/staff";

export type StaffDaysFilter = "7" | "30" | "90";

export type StaffDateRange =
  | { kind: "preset"; days: StaffDaysFilter }
  | { kind: "custom"; from: string; to: string };

export type StaffUrlFilters = {
  search: string;
  action: StaffActionFilter;
  range: StaffDateRange;
  staffUserId: string | null;
};

const DAYS = new Set<StaffDaysFilter>(["7", "30", "90"]);
const ACTIONS = new Set<StaffActionFilter>(["all", "messages", "closes", "notes"]);
const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

export const STAFF_RANGE_PRESETS: { days: StaffDaysFilter; label: string }[] = [
  { days: "7", label: "Last 7 days" },
  { days: "30", label: "Last 30 days" },
  { days: "90", label: "Last 90 days" },
];

export function isDateParam(value: string): boolean {
  if (!DATE_PARAM_RE.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateParam(value: string): Date | null {
  if (!isDateParam(value)) return null;
  return new Date(`${value}T00:00:00`);
}

export function formatDisplayDate(value: string): string {
  const date = parseDateParam(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRangeLabel(range: StaffDateRange): string {
  if (range.kind === "preset") {
    return STAFF_RANGE_PRESETS.find((preset) => preset.days === range.days)?.label ?? "Last 30 days";
  }
  return `${formatDisplayDate(range.from)} – ${formatDisplayDate(range.to)}`;
}

export function staffRangeToDateRange(range: StaffDateRange): DateRange | undefined {
  if (range.kind === "preset") {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (Number(range.days) - 1));
    return { from, to };
  }

  const from = parseDateParam(range.from);
  const to = parseDateParam(range.to);
  if (!from || !to) return undefined;
  return { from, to };
}

export function parseStaffFilters(searchParams: URLSearchParams): StaffUrlFilters {
  const actionParam = searchParams.get("action");
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  const action =
    actionParam && ACTIONS.has(actionParam as StaffActionFilter)
      ? (actionParam as StaffActionFilter)
      : "all";

  let range: StaffDateRange;
  if (from && isDateParam(from)) {
    const toValue = to && isDateParam(to) ? to : formatDateParam(new Date());
    range = { kind: "custom", from, to: toValue };
  } else {
    const daysParam = searchParams.get("days");
    const days =
      daysParam && DAYS.has(daysParam as StaffDaysFilter) ? (daysParam as StaffDaysFilter) : "30";
    range = { kind: "preset", days };
  }

  return {
    search: searchParams.get("search") ?? "",
    action,
    range,
    staffUserId: searchParams.get("staff")?.trim() || null,
  };
}

export function applyStaffFilters(
  current: URLSearchParams,
  patch: Partial<StaffUrlFilters>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const merged = { ...parseStaffFilters(current), ...patch };

  if (merged.search.trim()) next.set("search", merged.search.trim());
  else next.delete("search");

  if (merged.action !== "all") next.set("action", merged.action);
  else next.delete("action");

  if (merged.range.kind === "preset") {
    if (merged.range.days !== "30") next.set("days", merged.range.days);
    else next.delete("days");
    next.delete("from");
    next.delete("to");
  } else {
    next.set("from", merged.range.from);
    next.set("to", merged.range.to);
    next.delete("days");
  }

  if (merged.staffUserId) next.set("staff", merged.staffUserId);
  else next.delete("staff");

  return next;
}
