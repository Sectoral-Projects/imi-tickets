export function parseHighlightedMessageIds(
  searchParams: URLSearchParams,
): Set<number> {
  const raw = searchParams.get("messageId");
  if (!raw) return new Set();

  const ids = new Set<number>();
  for (const part of raw.split(",")) {
    const id = Number(part.trim());
    if (!Number.isNaN(id) && id > 0) ids.add(id);
  }

  return ids;
}

export function formatHighlightedMessageIds(ids: Iterable<number>): string | null {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted.join(",") : null;
}

export function toggleHighlightedMessageId(
  current: Set<number>,
  messageId: number,
): number[] {
  const next = new Set(current);
  if (next.has(messageId)) next.delete(messageId);
  else next.add(messageId);
  return [...next].sort((a, b) => a - b);
}
