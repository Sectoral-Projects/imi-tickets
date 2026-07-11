import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchMessages } from "../api/messages";

export function useMessages(threadId: number) {
  return useInfiniteQuery({
    queryKey: ["messages", threadId] as const,
    queryFn: fetchMessages,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(threadId),
    // Server returns each page newest-first (offset cursor = "further back
    // in time"), so pages concatenate in overall descending order. A single
    // reverse of the flattened list gives correct oldest→newest chat order.
    select: (data) => ({
      ...data,
      messages: data.pages.flatMap((p) => p.messages).reverse(),
    }),
  });
}