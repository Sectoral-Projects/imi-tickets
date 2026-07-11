import type { Ticket, ThreadParticipant } from "../../schemas/tickets";
import { isSystemTranscriptMessage } from "../system-message";

export type MessageSourceLabel = "DM" | "Staff" | "System";

export function resolveMessageSourceLabel(
  channelId: string,
  ticket: Pick<Ticket, "dmChannelId" | "channelId"> & {
    participants?: Pick<ThreadParticipant, "dmChannelId">[];
  },
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

  return "Staff";
}
