import { describe, expect, it } from "vitest";
import {
  MESSAGE_GROUP_WINDOW_MS,
  MAX_ADJACENT_GROUP_MESSAGES,
  MAX_TIMELINE_ROWS_PER_PAGE,
  canGroupAdjacentMessages,
  completePageAtGroupBoundary,
  takeCompleteGroups,
  timelineGroupFetchRowLimit,
  type AdjacentMessageGroupCandidate,
} from "./timeline";

function candidate(
  overrides: Partial<AdjacentMessageGroupCandidate> = {},
): AdjacentMessageGroupCandidate {
  return {
    authorId: "user-1",
    channelId: "channel-1",
    createdAt: 1_000_000,
    isPrivateStaff: false,
    hasReply: false,
    ...overrides,
  };
}

describe("canGroupAdjacentMessages", () => {
  it("groups chronological messages at the two-minute boundary", () => {
    const older = candidate();
    const newer = candidate({
      createdAt: 1_000_000 + MESSAGE_GROUP_WINDOW_MS,
    });

    expect(canGroupAdjacentMessages(older, newer)).toBe(true);
  });

  it.each([
    ["different author", candidate({ authorId: "user-2" })],
    ["different channel", candidate({ channelId: "channel-2" })],
    ["private note", candidate({ isPrivateStaff: true })],
    ["reply", candidate({ hasReply: true })],
    [
      "outside the time window",
      candidate({ createdAt: 1_000_000 + MESSAGE_GROUP_WINDOW_MS + 1 }),
    ],
  ])("does not group a %s", (_label, newer) => {
    expect(canGroupAdjacentMessages(candidate(), newer)).toBe(false);
  });

  it("does not group reversed timestamps", () => {
    expect(
      canGroupAdjacentMessages(
        candidate({ createdAt: 2_000_000 }),
        candidate({ createdAt: 1_000_000 }),
      ),
    ).toBe(false);
  });
});

describe("completePageAtGroupBoundary", () => {
  it("keeps the base page when the next row starts a new group", () => {
    expect(
      completePageAtGroupBoundary([1, 2, 10, 11], 2, (edge, next) => {
        return next === edge + 1;
      }),
    ).toEqual([1, 2]);
  });

  it("completes a boundary group and stops at its first break", () => {
    expect(
      completePageAtGroupBoundary([1, 2, 3, 4, 10], 2, (edge, next) => {
        return next === edge + 1;
      }),
    ).toEqual([1, 2, 3, 4]);
  });

  it("hard-caps the extension at 30 rows", () => {
    const rows = Array.from({ length: 70 }, (_, index) => index);

    expect(completePageAtGroupBoundary(rows, 30, () => true)).toHaveLength(60);
  });
});

type TestRow =
  | { kind: "message"; id: number; chain: number }
  | { kind: "audit"; id: number };

function takeFrom(rows: TestRow[], groupLimit: number, maxRows?: number) {
  return takeCompleteGroups(
    rows,
    groupLimit,
    (edge, candidate) =>
      edge.kind === "message" &&
      candidate.kind === "message" &&
      edge.chain === candidate.chain,
    (row) => row.kind === "audit",
    maxRows,
  );
}

describe("takeCompleteGroups", () => {
  it("takes a fixed number of complete message groups", () => {
    const rows: TestRow[] = [
      { kind: "message", id: 1, chain: 1 },
      { kind: "message", id: 2, chain: 1 },
      { kind: "message", id: 3, chain: 2 },
      { kind: "message", id: 4, chain: 2 },
      { kind: "message", id: 5, chain: 2 },
      { kind: "message", id: 6, chain: 3 },
    ];

    expect(takeFrom(rows, 2).map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("treats audits as singleton groups", () => {
    const rows: TestRow[] = [
      { kind: "message", id: 1, chain: 1 },
      { kind: "audit", id: 2 },
      { kind: "message", id: 3, chain: 2 },
      { kind: "message", id: 4, chain: 2 },
    ];

    expect(takeFrom(rows, 2).map((row) => row.id)).toEqual([1, 2]);
  });

  it("hard-caps total rows", () => {
    const rows: TestRow[] = Array.from({ length: 40 }, (_, index) => ({
      kind: "message" as const,
      id: index,
      chain: Math.floor(index / 5),
    }));

    expect(takeFrom(rows, 15, 12)).toHaveLength(12);
  });

  it("caps a single chain at MAX_ADJACENT_GROUP_MESSAGES", () => {
    const rows: TestRow[] = Array.from(
      { length: MAX_ADJACENT_GROUP_MESSAGES + 10 },
      (_, index) => ({
        kind: "message" as const,
        id: index,
        chain: 1,
      }),
    );

    expect(takeFrom(rows, 1)).toHaveLength(MAX_ADJACENT_GROUP_MESSAGES);
  });

  it("exposes a fetch buffer sized for groupLimit with a +1 probe", () => {
    expect(timelineGroupFetchRowLimit(15)).toBe(
      Math.min(15 * MAX_ADJACENT_GROUP_MESSAGES, MAX_TIMELINE_ROWS_PER_PAGE) + 1,
    );
  });
});
