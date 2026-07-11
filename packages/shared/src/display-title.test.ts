import { describe, it, expect } from "vitest";
import {
  resolveTicketDisplayTitle,
  formatTicketListTitle,
  type TicketTitleSource,
} from "./display-title";

describe("resolveTicketDisplayTitle", () => {
  it("returns subject when present", () => {
    const ticket: TicketTitleSource = { id: 1, subject: "Login issue" };
    expect(resolveTicketDisplayTitle(ticket)).toBe("Login issue");
  });

  it("falls back to Ticket #N when no subject", () => {
    const ticket: TicketTitleSource = { id: 42 };
    expect(resolveTicketDisplayTitle(ticket)).toBe("Ticket #42");
  });

  it("trims whitespace from subject", () => {
    const ticket: TicketTitleSource = { id: 1, subject: "  spaced  " };
    expect(resolveTicketDisplayTitle(ticket)).toBe("spaced");
  });

  it("falls back to Ticket #N when subject is empty string", () => {
    const ticket: TicketTitleSource = { id: 5, subject: "" };
    expect(resolveTicketDisplayTitle(ticket)).toBe("Ticket #5");
  });

  it("falls back to Ticket #N when subject is null", () => {
    const ticket: TicketTitleSource = { id: 7, subject: null };
    expect(resolveTicketDisplayTitle(ticket)).toBe("Ticket #7");
  });

  it("prefers staffChannelName when useChannelNameForTranscript is true", () => {
    const ticket: TicketTitleSource = {
      id: 1,
      subject: "Bug report",
      staffChannelName: "bug-123",
    };
    expect(
      resolveTicketDisplayTitle(ticket, { useChannelNameForTranscript: true }),
    ).toBe("bug-123");
  });

  it("falls back to subject when staffChannelName is blank with useChannelNameForTranscript", () => {
    const ticket: TicketTitleSource = {
      id: 1,
      subject: "Bug report",
      staffChannelName: "  ",
    };
    expect(
      resolveTicketDisplayTitle(ticket, { useChannelNameForTranscript: true }),
    ).toBe("Bug report");
  });
});

describe("formatTicketListTitle", () => {
  it("returns 'Title - #N' when subject exists", () => {
    const ticket: TicketTitleSource = { id: 3, subject: "Help" };
    expect(formatTicketListTitle(ticket)).toBe("Help - #3");
  });

  it("returns just 'Ticket #N' when no subject", () => {
    const ticket: TicketTitleSource = { id: 10 };
    expect(formatTicketListTitle(ticket)).toBe("Ticket #10");
  });

  it("prefers staffChannelName when useChannelNameForTranscript is true", () => {
    const ticket: TicketTitleSource = {
      id: 2,
      subject: "X",
      staffChannelName: "channel-name",
    };
    expect(
      formatTicketListTitle(ticket, { useChannelNameForTranscript: true }),
    ).toBe("channel-name");
  });
});