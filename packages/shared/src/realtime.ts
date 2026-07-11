/**
 * Union of all realtime WebSocket events emitted by the bot server.
 */
export type RealtimeEvent =
  | { type: "ticket.created"; ticketId: number }
  | { type: "ticket.updated"; ticketId: number; status?: string; staffChannelName?: string }
  | { type: "message.created"; ticketId: number; messageId: number }
  | { type: "message.updated"; ticketId: number; messageId: number };

export type TicketMessageActivityEvent = Extract<
  RealtimeEvent,
  { type: "message.created" } | { type: "message.updated" }
>;