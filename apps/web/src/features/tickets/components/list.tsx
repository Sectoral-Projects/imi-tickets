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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthGate, useProductAccessRedirect } from "@/lib/use-auth-gate";
import { useRealtime } from "@/lib/use-realtime";
import { useClientPreferences } from "@/features/settings/hooks/settings";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { TicketListSkeleton } from "./ticket-list-skeleton";
import { AuthorHoverCard } from "./author-hover-card";
import { ticketStatusBadgeVariant } from "../utils/status-badge";
import { formatTicketListTitle } from "../utils/display-title";
import { UnauthorizedScreen } from "@/components/unauthorized-screen";
import { ApiError } from "@/lib/api";

type TicketStatusFilter = "all" | "open" | "closed";

const EDGE_LOAD_THRESHOLD_PX = 600;

type TicketListRenderItem =
  | { kind: "ticket"; ticket: EnrichedTicket }
  | { kind: "load-sentinel" }
  | { kind: "end-marker" };

export function TicketList() {
  "use no memo";

  const session = useAuthGate();
  const { data: preferences } = useClientPreferences(Boolean(session.data));
  const useChannelNameForTranscript = Boolean(preferences?.useChannelNameForTranscript);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
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

  // Initial load only — keep the search bar mounted while filter queries refetch.
  const showInitialSkeleton = isLoading && !data;

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

  if (showInitialSkeleton) {
    return <TicketListSkeleton />;
  }

  if (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") {
      return (
        <UnauthorizedScreen description="You need the Read permission to view tickets." />
      );
    }

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
            placeholder="Search titles, people, or messages..."
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

function ticketOpenerLabel(ticket: EnrichedTicket) {
  return (
    ticket.user?.nickname ??
    ticket.user?.globalName ??
    ticket.user?.username ??
    ticket.userId
  );
}

function ticketOpenerAvatarUrl(ticket: EnrichedTicket) {
  const avatar = ticket.user?.avatar;
  const userId = ticket.user?.userId ?? ticket.userId;
  if (!avatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function TicketListItem({
  ticket,
  useChannelNameForTranscript,
}: {
  ticket: EnrichedTicket;
  useChannelNameForTranscript: boolean;
}) {
  const title = formatTicketListTitle(ticket, { useChannelNameForTranscript });
  const openerLabel = ticketOpenerLabel(ticket);
  const openerInitials = openerLabel.slice(0, 2).toUpperCase();

  return (
    <Card className="relative transition-colors hover:bg-muted/40">
      <Link
        to={`/${ticket.id}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open ticket ${title}`}
      />
      <CardHeader className="relative z-10 pointer-events-none">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-lg font-medium">{title}</div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={ticketStatusBadgeVariant(ticket.status)}
              className="text-sm capitalize"
            >
              {ticket.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pointer-events-none">
        <div className="pointer-events-auto w-fit max-w-full">
          <AuthorHoverCard userId={ticket.userId}>
            <span className="inline-flex max-w-full items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8">
                <AvatarImage
                  src={ticketOpenerAvatarUrl(ticket)}
                  alt={openerLabel}
                />
                <AvatarFallback className="text-xs">{openerInitials}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-muted-foreground">
                {openerLabel}
              </span>
            </span>
          </AuthorHoverCard>
        </div>
      </CardContent>
    </Card>
  );
}
