import { api } from "@/lib/api";
import {
  TIMELINE_GROUP_LIMIT,
  TIMELINE_WINDOW_GROUP_LIMIT,
} from "@imi/tickets-shared";
import type { TimelineResponse, TimelineWindowResponse } from "../schemas/timeline";
import type { QueryFunctionContext } from "@tanstack/react-query";

type TimelineQueryKey = readonly ["timeline", number];

export type TimelineWindowDirection = "older" | "newer";

export type TimelineWindowParams =
  | {
      messageId: number;
      limit?: number;
    }
  | {
      windowCursor: string;
      direction: TimelineWindowDirection;
      limit?: number;
    };

export const fetchTimeline = async ({
  pageParam = 0,
  queryKey,
}: QueryFunctionContext<TimelineQueryKey, number>) => {
  const [, ticketId] = queryKey;
  const params = new URLSearchParams({
    cursor: String(pageParam),
    limit: String(TIMELINE_GROUP_LIMIT),
  });

  return await api.get<TimelineResponse>(
    `/tickets/${ticketId}/timeline?${params}`,
  );
};

export async function fetchTimelineWindow(
  ticketId: number,
  params: TimelineWindowParams,
) {
  const query = new URLSearchParams();

  if ("messageId" in params) {
    query.set("messageId", String(params.messageId));
  } else {
    query.set("windowCursor", params.windowCursor);
    query.set("direction", params.direction);
  }

  query.set(
    "limit",
    String(params.limit ?? TIMELINE_WINDOW_GROUP_LIMIT),
  );

  return await api.get<TimelineWindowResponse>(
    `/tickets/${ticketId}/timeline?${query}`,
  );
}
