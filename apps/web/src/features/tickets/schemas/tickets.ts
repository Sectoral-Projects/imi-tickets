// Re-export Zod schemas from shared package
export {
  memberSnapshotSchema,
  latestMessageSchema,
  ticketSchema,
  threadParticipantSchema,
  ticketWithParticipantsSchema,
  enrichedTicketSchema,
  type LatestMessage,
  type MemberSnapshot,
  type Ticket,
  type ThreadParticipant,
  type TicketWithParticipants,
  type EnrichedTicket,
} from "@imi/tickets-shared";

/** @deprecated Use LatestMessage instead */
export type LattestMessage = import("@imi/tickets-shared").LatestMessage;