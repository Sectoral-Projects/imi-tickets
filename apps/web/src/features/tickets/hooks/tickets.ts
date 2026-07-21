import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchTicket, fetchTickets } from "../api/tickets";

export function useTickets(search: string, status: string | null = null) {
  return useInfiniteQuery({
    queryKey: ["tickets", search, status] as const,
    queryFn: fetchTickets,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    // 🔥 flatten pages → tickets[]
    select: (data) => ({
      ...data,
      tickets: data.pages.flatMap((p) => p.tickets),
    }),
  });
}

export function useTicket(ticketId: string) {
  return useQuery({
    queryKey: ["ticket", ticketId] as const,
    queryFn: fetchTicket,
    enabled: Boolean(ticketId),
  });
}