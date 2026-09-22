/**
 * Union of all realtime WebSocket events emitted by the bot server.
 */
export type RealtimeEvent =
  | { type: "ticket.created"; ticketId: number }
  | { type: "ticket.updated"; ticketId: number; status?: string; staffChannelName?: string }
  | { type: "message.created"; ticketId: number; messageId: number; authorId?: string }
  | { type: "message.updated"; ticketId: number; messageId: number }
  | {
      type: "typing.start";
      ticketId: number;
      userId: string;
      username?: string | null;
      globalName?: string | null;
      avatar?: string | null;
    };

export type TicketMessageActivityEvent = Extract<
  RealtimeEvent,
  { type: "message.created" } | { type: "message.updated" }
>;