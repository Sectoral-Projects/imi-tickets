import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchTimeline } from "../api/timeline";
import { timelineItemKey } from "../utils/timeline/blocks";

export function useTimeline(ticketId: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["timeline", ticketId] as const,
    queryFn: fetchTimeline,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(ticketId) && enabled,
    select: (data) => {
      const chronologicalPages = [...data.pages]
        .reverse()
        .map((page) => [...page.items].reverse());

      return {
        ...data,
        items: chronologicalPages.flat(),
        // Each page keeps its own visual message groups. When an older page is
        // prepended, the first row of every existing page stays the same shape.
        groupBreakBeforeKeys: chronologicalPages
          .slice(1)
          .map((page) => page[0])
          .filter((item) => item !== undefined)
          .map(timelineItemKey),
      };
    },
  });
}
