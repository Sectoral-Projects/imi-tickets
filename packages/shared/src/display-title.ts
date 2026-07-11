export type TicketTitleSource = {
  id: number;
  subject?: string | null;
  staffChannelName?: string | null;
};

/**
 * Resolve the primary display title for a ticket.
 * Prefers subject; falls back to "Ticket #N".
 * When useChannelNameForTranscript is set, the staff channel name takes priority.
 */
export function resolveTicketDisplayTitle(
  ticket: TicketTitleSource,
  options: { useChannelNameForTranscript?: boolean } = {},
): string {
  if (options.useChannelNameForTranscript) {
    const channelName = ticket.staffChannelName?.trim();
    if (channelName) return channelName;
  }

  const subject = ticket.subject?.trim();
  return subject || `Ticket #${ticket.id}`;
}

/**
 * Format a ticket title for list views (appends #id when a custom title exists).
 */
export function formatTicketListTitle(
  ticket: TicketTitleSource,
  options: { useChannelNameForTranscript?: boolean } = {},
): string {
  if (options.useChannelNameForTranscript) {
    const channelName = ticket.staffChannelName?.trim();
    if (channelName) return channelName;
  }

  const title = resolveTicketDisplayTitle(ticket, options);
  if (title === `Ticket #${ticket.id}`) return title;
  return `${title} - #${ticket.id}`;
}