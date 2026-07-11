import { describe, expect, it } from "vitest";
import {
  MESSAGE_GROUP_WINDOW_MS,
  canGroupAdjacentMessages,
  completePageAtGroupBoundary,
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

    expect(
      completePageAtGroupBoundary(rows, 30, () => true),
    ).toHaveLength(60);
  });
});
