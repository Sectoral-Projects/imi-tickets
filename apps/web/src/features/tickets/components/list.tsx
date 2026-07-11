import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EnrichedTicket } from "../schemas/tickets";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTickets } from "../hooks/tickets";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthGate, useProductAccessRedirect } from "@/lib/use-auth-gate";
import { useRealtime } from "@/lib/use-realtime";
import { useSettings } from "@/features/settings/hooks/settings";
import { TicketListSkeleton } from "./ticket-list-skeleton";
import { ticketStatusBadgeVariant } from "../utils/status-badge";
import { formatTicketListTitle } from "../utils/display-title";

type TicketStatusFilter = "all" | "open" | "closed";

const EDGE_LOAD_THRESHOLD_PX = 600;

type TicketListRenderItem =
  | { kind: "ticket"; ticket: EnrichedTicket }
  | { kind: "load-sentinel" }
  | { kind: "end-marker" };

export function TicketList() {
  "use no memo";

  const session = useAuthGate();
  const { data: settings } = useSettings();
  const useChannelNameForTranscript = Boolean(settings?.settings.useChannelNameForTranscript);
  const [searchInput, setSearchInput] = useState("");
  const search = searchInput;
  const [status, setStatus] = useState<TicketStatusFilter>("all");
  const statusFilter = status === "all" ? null : status;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useTickets(search, statusFilter);

  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useProductAccessRedirect(error);
  useRealtime();

  const tickets = useMemo(() => data?.tickets ?? [], [data?.tickets]);
  const contentReady = !isLoading && Boolean(data);

  const listRenderItems = useMemo<TicketListRenderItem[]>(() => {
    const items: TicketListRenderItem[] = tickets.map((ticket) => ({
      kind: "ticket",
      ticket,
    }));

    if (hasNextPage) {
      items.push({ kind: "load-sentinel" });
    } else if (tickets.length > 0) {
      items.push({ kind: "end-marker" });
    }

    return items;
  }, [hasNextPage, tickets]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual owns scroll state outside React memoization.
  const rowVirtualizer = useVirtualizer({
    count: listRenderItems.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize: (index) => {
      const item = listRenderItems[index];
      if (!item) return 120;
      if (item.kind === "load-sentinel") return 40;
      if (item.kind === "end-marker") return 56;
      return 120;
    },
    getItemKey: (index) => {
      const item = listRenderItems[index];
      if (!item) return index;
      if (item.kind === "load-sentinel") return "load-sentinel";
      if (item.kind === "end-marker") return "end-marker";
      return `ticket-${item.ticket.id}`;
    },
    overscan: 6,
    useFlushSync: false,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const maybeLoadMore = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || isFetchingNextPage || !hasNextPage) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom <= EDGE_LOAD_THRESHOLD_PX) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleListScroll = useCallback(() => {
    maybeLoadMore();
  }, [maybeLoadMore]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) viewport.scrollTop = 0;
  }, [search, statusFilter]);

  useEffect(() => {
    if (!contentReady) return;

    const frameId = requestAnimationFrame(() => maybeLoadMore());
    return () => cancelAnimationFrame(frameId);
  }, [contentReady, listRenderItems.length, maybeLoadMore]);

  const firstVirtualIndex = virtualItems[0]?.index ?? null;
  const lastVirtualIndex = virtualItems.at(-1)?.index ?? null;
  useEffect(() => {
    if (firstVirtualIndex === null || lastVirtualIndex === null) return;
    maybeLoadMore();
  }, [firstVirtualIndex, lastVirtualIndex, maybeLoadMore]);

  if (session.isPending || !session.data) {
    return <TicketListSkeleton />;
  }

  if (isLoading && !data) {
    return <TicketListSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground md:p-6">
        Error: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground md:p-6">No data</div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 p-4 md:p-6">
        <div className="flex flex-row gap-3">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tickets..."
          />
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as TicketStatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="px-4 pb-4 text-sm text-muted-foreground md:px-6 md:pb-6">
            No tickets found.
          </div>
        ) : (
          <ScrollArea
            className="size-full"
            viewportClassName="[overflow-anchor:none] [overscroll-behavior:contain]"
            viewportRef={scrollViewportRef}
            onViewportScroll={handleListScroll}
          >
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualItem) => {
                const item = listRenderItems[virtualItem.index];
                if (!item) return null;

                return (
                  <div
                    key={virtualItem.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualItem.index}
                    className="absolute top-0 left-0 w-full px-4 pb-4 md:px-6"
                    style={{
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {item.kind === "ticket" && (
                      <TicketListItem
                        ticket={item.ticket}
                        useChannelNameForTranscript={useChannelNameForTranscript}
                      />
                    )}

                    {item.kind === "load-sentinel" && (
                      <div className="py-2 text-center text-sm text-muted-foreground">
                        {isFetchingNextPage ? "Loading more..." : ""}
                      </div>
                    )}

                    {item.kind === "end-marker" && (
                      <Card className="m-auto w-fit px-5 text-center font-semibold">
                        No more tickets!
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function TicketListItem({
  ticket,
  useChannelNameForTranscript,
}: {
  ticket: EnrichedTicket;
  useChannelNameForTranscript: boolean;
}) {
  return (
    <Link to={`/${ticket.id}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-lg font-medium">
              {formatTicketListTitle(ticket, { useChannelNameForTranscript })}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={ticketStatusBadgeVariant(ticket.status)}
                className="text-sm capitalize"
              >
                {ticket.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-sm">
              {ticket.user?.nickname ??
                ticket.user?.globalName ??
                ticket.userId}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
