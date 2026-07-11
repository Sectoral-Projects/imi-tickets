import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchTimeline } from "../api/timeline";

export function useTimeline(ticketId: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["timeline", ticketId] as const,
    queryFn: fetchTimeline,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(ticketId) && enabled,
    select: (data) => ({
      ...data,
      items: [...data.pages]
        .reverse()
        .flatMap((page) => [...page.items].reverse()),
    }),
  });
}
