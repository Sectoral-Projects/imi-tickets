import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchStaffAnalytics, staffAnalyticsQueryKey, type StaffAnalyticsParams } from "../api/staff";

export function useStaffAnalytics(params: StaffAnalyticsParams) {
  return useQuery({
    queryKey: staffAnalyticsQueryKey(params),
    queryFn: () => fetchStaffAnalytics(params),
    placeholderData: keepPreviousData,
  });
}
