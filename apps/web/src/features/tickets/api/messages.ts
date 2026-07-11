// api/messages.ts
import { api } from "@/lib/api";
import type { EnrichedMessage } from "../schemas/messages";
import type { QueryFunctionContext } from "@tanstack/react-query";

export type MessagesResponse = {
  messages: EnrichedMessage[];
  nextCursor: number | null;
};

type MessagesQueryKey = readonly ["messages", number];

export const fetchMessages = async ({
  pageParam = 0,
  queryKey,
}: QueryFunctionContext<MessagesQueryKey, number>) => {
  const [, threadId] = queryKey;
  const params = new URLSearchParams({
    threadId: String(threadId),
    cursor: String(pageParam),
  });

  return await api.get<MessagesResponse>(`/messages?${params}`);
};