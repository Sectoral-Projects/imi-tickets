import { api } from "@/lib/api";
import type { StaffActionFilter, StaffAnalyticsResponse } from "../schemas/staff";
import type { StaffDateRange } from "../utils/staff-filters";

export type StaffAnalyticsParams = {
  search?: string;
  action?: StaffActionFilter;
  range: StaffDateRange;
  staffUserId?: string | null;
};

function staffRangeQueryKey(range: StaffDateRange) {
  if (range.kind === "preset") return `preset:${range.days}`;
  return `custom:${range.from}:${range.to}`;
}

export function staffAnalyticsQueryKey(params: StaffAnalyticsParams) {
  return [
    "staff",
    params.search ?? "",
    params.action ?? "all",
    staffRangeQueryKey(params.range),
    params.staffUserId ?? "",
  ] as const;
}

export async function fetchStaffAnalytics(params: StaffAnalyticsParams) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.action && params.action !== "all") query.set("action", params.action);
  if (params.range.kind === "preset") {
    query.set("days", params.range.days);
  } else {
    query.set("from", params.range.from);
    query.set("to", params.range.to);
  }
  if (params.staffUserId) query.set("staffUserId", params.staffUserId);

  const suffix = query.size > 0 ? `?${query}` : "";
  return api.get<StaffAnalyticsResponse>(`/staff${suffix}`);
}
