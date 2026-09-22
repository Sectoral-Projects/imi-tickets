import { useEffect, useRef } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { EnrichedTicket } from "@/features/tickets/schemas/tickets";
import {
  applyTypingStart,
  clearTicketTypers,
} from "@/features/tickets/lib/ticket-typing";
import type { RealtimeEvent, TicketMessageActivityEvent } from "@imi/tickets-shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

type TicketsPage = {
  tickets: EnrichedTicket[];
  nextCursor: number | null;
};

function bumpTicketMessageCount(
  queryClient: ReturnType<typeof useQueryClient>,
  ticketId: number,
) {
  queryClient.setQueriesData<InfiniteData<TicketsPage>>({ queryKey: ["tickets"] }, (current) => {
    if (!current) return current;

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        tickets: page.tickets.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, messageCount: (ticket.messageCount ?? 0) + 1 }
            : ticket,
        ),
      })),
    };
  });
}

function patchTicketStaffChannelName(
  queryClient: ReturnType<typeof useQueryClient>,
  ticketId: number,
  staffChannelName: string,
) {
  queryClient.setQueryData(["ticket", String(ticketId)], (current) => {
    if (!current || typeof current !== "object") return current;
    return { ...current, staffChannelName };
  });

  queryClient.setQueriesData<InfiniteData<TicketsPage>>({ queryKey: ["tickets"] }, (current) => {
    if (!current) return current;

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        tickets: page.tickets.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, staffChannelName } : ticket,
        ),
      })),
    };
  });
}

export { type RealtimeEvent, type TicketMessageActivityEvent };

export function useRealtime(
  ticketId?: number,
  options?: {
    onTicketMessageActivity?: (event: TicketMessageActivityEvent) => void;
  },
) {
  const queryClient = useQueryClient();

  // Keep the latest callback in a ref so the socket handler can call it
  // without putting the function in the WebSocket effect deps.
  const onActivityRef = useRef(options?.onTicketMessageActivity);
  useEffect(() => {
    onActivityRef.current = options?.onTicketMessageActivity;
  });

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as RealtimeEvent;

        if (data.type === "typing.start") {
          applyTypingStart({
            ...data,
            ticketId: Number(data.ticketId),
          });
          return;
        }

        if (data.type === "message.created") {
          clearTicketTypers(data.ticketId, data.authorId);
          bumpTicketMessageCount(queryClient, data.ticketId);
        }

        if (data.type === "ticket.updated" && data.staffChannelName !== undefined) {
          patchTicketStaffChannelName(queryClient, data.ticketId, data.staffChannelName);
        } else if (
          data.type === "ticket.created" ||
          data.type === "ticket.updated" ||
          data.type === "message.created" ||
          data.type === "message.updated"
        ) {
          void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        }

        if (ticketId !== undefined && data.ticketId === ticketId) {
          if (
            data.type === "ticket.created" ||
            (data.type === "ticket.updated" && data.staffChannelName === undefined)
          ) {
            void queryClient.invalidateQueries({
              queryKey: ["ticket", String(ticketId)],
            });
            void queryClient.invalidateQueries({
              queryKey: ["timeline", ticketId],
            });
          }

          if (data.type === "message.created" || data.type === "message.updated") {
            onActivityRef.current?.(data);
            void queryClient.invalidateQueries({ queryKey: ["timeline", ticketId] });
          }
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => ws.close();
  }, [queryClient, ticketId]);
}