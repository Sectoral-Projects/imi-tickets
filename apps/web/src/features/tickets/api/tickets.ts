// api/tickets.ts
import { api } from "@/lib/api";
import type { EnrichedTicket, TicketWithParticipants } from "../schemas/tickets";
import type { QueryFunctionContext } from "@tanstack/react-query";

export type TicketsResponse = {
  tickets: EnrichedTicket[];
  nextCursor: number | null;
};

type TicketsQueryKey = readonly ["tickets", string, string | null];
type TicketQueryKey = readonly ["ticket", string];

export const fetchTickets = async ({
  pageParam = 0,
  queryKey,
}: QueryFunctionContext<TicketsQueryKey, number>) => {
  const [, search, status] = queryKey;
  const params = new URLSearchParams({ cursor: String(pageParam) });
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  return await api.get<TicketsResponse>(`/tickets?${params}`);
};

export const fetchTicket = async ({
  queryKey,
}: QueryFunctionContext<TicketQueryKey>) => {
  const [, ticketId] = queryKey;
  return await api.get<TicketWithParticipants>(`/tickets/${ticketId}`);
};