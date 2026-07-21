import type { Ticket, ThreadParticipant } from "../../schemas/tickets";
import { isSystemTranscriptMessage } from "../system-message";

export type MessageSourceLabel = "DM" | "Staff" | "System";

type MessageSourceTicket = Pick<Ticket, "dmChannelId" | "channelId" | "userId"> & {
  participants?: Pick<ThreadParticipant, "dmChannelId" | "userId" | "role">[];
};

function isTicketMemberAuthor(authorId: string, ticket: MessageSourceTicket): boolean {
  if (authorId === ticket.userId) return true;
  return (
    ticket.participants?.some(
      (participant) => participant.userId === authorId && participant.role === "user",
    ) ?? false
  );
}

export function resolveMessageSourceLabel(
  channelId: string,
  ticket: MessageSourceTicket,
  authorId?: string,
): MessageSourceLabel {
  if (authorId && isSystemTranscriptMessage(authorId)) {
    return "System";
  }

  if (ticket.dmChannelId && channelId === ticket.dmChannelId) {
    return "DM";
  }

  if (ticket.participants?.some((participant) => participant.dmChannelId === channelId)) {
    return "DM";
  }

  // Member button templates / modal answers are Discord-copied into the staff channel
  // but should still read as DM in the transcript.
  if (authorId && isTicketMemberAuthor(authorId, ticket)) {
    return "DM";
  }

  return "Staff";
}
