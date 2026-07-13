import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchTimeline } from "../api/timeline";
import {
  buildTimelineBlocks,
  type TimelineBlock,
} from "../utils/timeline/blocks";

export function useTimeline(ticketId: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["timeline", ticketId] as const,
    queryFn: fetchTimeline,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(ticketId) && enabled,
    select: (data) => {
      // API pages are newest-first. Chronological pages are oldest→newest.
      // Build blocks per page before concatenating so each page's groups stay
      // immutable when an older page is prepended (TanStack chat contract).
      const chronologicalPages = [...data.pages]
        .reverse()
        .map((page) => [...page.items].reverse());

      const pageBlocks: TimelineBlock[][] = chronologicalPages.map((items) =>
        buildTimelineBlocks(items),
      );

      return {
        ...data,
        items: chronologicalPages.flat(),
        blocks: pageBlocks.flat(),
      };
    },
  });
}
