export type TicketOpenButtonMode = "off" | "before_open";

export const MODAL_TEMPLATE_CATEGORY = "modal";

export const TICKET_OPEN_MODE_OPTIONS: ReadonlyArray<{
  value: TicketOpenButtonMode;
  label: string;
  help: string;
}> = [
  {
    value: "off",
    label: "Open immediately",
    help: "Create the ticket as soon as the member sends their first message.",
  },
  {
    value: "before_open",
    label: "Wait for button",
    help: "Show the ticket-open prompt and create the ticket only after the member picks a category button. The button label becomes the ticket subject.",
  },
];

export function ticketOpenModeLabel(mode: TicketOpenButtonMode | string) {
  const normalized = normalizeTicketOpenButtonMode(mode);
  return TICKET_OPEN_MODE_OPTIONS.find((option) => option.value === normalized)?.label ?? "Open immediately";
}

export function normalizeTicketOpenButtonMode(mode?: string | null): TicketOpenButtonMode {
  if (mode === "before_open") return "before_open";
  return "off";
}
