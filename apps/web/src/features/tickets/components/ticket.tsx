import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
} from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useTicket } from "../hooks/tickets";
import { useTimeline } from "../hooks/timeline";
import { useParams, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  formatHighlightedMessageIds,
  parseHighlightedMessageIds,
  toggleHighlightedMessageId,
} from "../utils/timeline/highlighted-messages";
import { useAuthGate, useProductAccessRedirect } from "@/lib/use-auth-gate";
import { useRealtime } from "@/lib/use-realtime";
import { useSettings } from "@/features/settings/hooks/settings";
import { ticketStatusBadgeVariant } from "../utils/status-badge";
import { resolveTicketDisplayTitle } from "../utils/display-title";
import { TicketDetailSkeleton } from "./ticket-detail-skeleton";
import { MessageTimelineRow } from "./ticket-message-row";
import { useTimelineWindow } from "./hooks/use-timeline-window";
import {
  useTimelineVirtualizer,
  TIMELINE_SENTINEL_SIZE_PX,
} from "./hooks/use-timeline-virtualizer";

const REPLY_JUMP_FLASH_DURATION_MS = 2750;

function SeekOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-6 shadow-sm">
        <Loader2
          className="size-7 animate-spin text-primary"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">
          Jumping to message&hellip;
        </p>
        <p className="text-xs text-muted-foreground">Loading nearby messages</p>
      </div>
    </div>
  );
}

export function TicketContent() {
  "use no memo";

  const { ticketId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useAuthGate();
  const numericTicketId = Number(ticketId!);
  const highlightedMessageIds = useMemo(
    () => parseHighlightedMessageIds(searchParams),
    [searchParams],
  );
  const sortedHighlightedIds = useMemo(
    () => [...highlightedMessageIds].sort((left, right) => left - right),
    [highlightedMessageIds],
  );
  const highlightKey = useMemo(
    () => formatHighlightedMessageIds(sortedHighlightedIds) ?? "",
    [sortedHighlightedIds],
  );
  const hasHighlightedMode = sortedHighlightedIds.length > 0;
  const currentUserId = session.data?.user?.id ?? null;
  const {
    data: ticket,
    isLoading: isLoadingTicket,
    error,
  } = useTicket(ticketId!);
  const { data: settings } = useSettings();
  const useChannelNameForTranscript = Boolean(
    settings?.settings.useChannelNameForTranscript,
  );
  const ticketDisplayTitle = ticket
    ? resolveTicketDisplayTitle(ticket, { useChannelNameForTranscript })
    : "";
  const {
    data: timelineData,
    isLoading: isLoadingTimeline,
    error: errorTimeline,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTimeline(numericTicketId, !hasHighlightedMode);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  const pendingScrollMessageIdRef = useRef<number | null>(null);
  const centeringRunningRef = useRef(false);
  const centerGenerationRef = useRef(0);
  const pendingReplyJumpFlashIdRef = useRef<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isCentering, setIsCentering] = useState(false);
  const [jumpAboveId, setJumpAboveId] = useState<number | null>(null);
  const [jumpBelowId, setJumpBelowId] = useState<number | null>(null);
  const [replyJumpFlashMessageId, setReplyJumpFlashMessageId] = useState<
    number | null
  >(null);
  const replyJumpFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const triggerReplyJumpFlashRef = useRef<(messageId: number) => void>(
    () => {},
  );

  const triggerReplyJumpFlash = useCallback((messageId: number) => {
    if (replyJumpFlashTimeoutRef.current) {
      clearTimeout(replyJumpFlashTimeoutRef.current);
    }

    setReplyJumpFlashMessageId(null);
    requestAnimationFrame(() => {
      setReplyJumpFlashMessageId(messageId);
      replyJumpFlashTimeoutRef.current = setTimeout(() => {
        setReplyJumpFlashMessageId((current) =>
          current === messageId ? null : current,
        );
        replyJumpFlashTimeoutRef.current = null;
      }, REPLY_JUMP_FLASH_DURATION_MS);
    });
  }, []);

  triggerReplyJumpFlashRef.current = triggerReplyJumpFlash;

  // Cleanup flash timeout on unmount
  useEffect(() => {
    return () => {
      if (replyJumpFlashTimeoutRef.current) {
        clearTimeout(replyJumpFlashTimeoutRef.current);
      }
    };
  }, []);

  const {
    windowState,
    setWindowState,
    windowPagingDirection,
    windowReasonRef,
    showFullTranscript,
    loadWindowAroundMessage,
    loadWindowPage,
  } = useTimelineWindow({
    ticketId: numericTicketId,
    scrollViewportRef,
    centerGenerationRef,
    centeringRunningRef,
    pendingScrollMessageIdRef,
    setIsSeeking,
    setIsCentering,
  });

  const usesWindowPaging = Boolean(windowState);
  const displayedItems = useMemo(
    () =>
      windowState?.items ??
      (hasHighlightedMode ? [] : (timelineData?.items ?? [])),
    [windowState, hasHighlightedMode, timelineData?.items],
  );
  const contentReady =
    !isLoadingTicket &&
    (hasHighlightedMode
      ? Boolean(windowState)
      : !isLoadingTimeline && Boolean(timelineData));
  const shouldSkipBottomScroll = usesWindowPaging || hasHighlightedMode;
  const isReplyTranscriptWindow = usesWindowPaging && !hasHighlightedMode;

  const {
    rowVirtualizer,
    virtualItems,
    timelineRenderItems,
    findRenderIndexForMessage,
    handleTimelineScroll,
    updateJumpTargets,
    finishPendingHighlightScroll,
  } = useTimelineVirtualizer({
    displayedItems,
    scrollViewportRef,
    hasHighlightedMode,
    sortedHighlightedIds,
    windowState,
    windowPagingDirection,
    usesWindowPaging,
    contentReady,
    shouldSkipBottomScroll,
    isCentering,
    isSeeking,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    numericTicketId,
    centerGenerationRef,
    centeringRunningRef,
    pendingScrollMessageIdRef,
    pendingReplyJumpFlashIdRef,
    didInitialScrollRef,
    triggerReplyJumpFlashRef,
    setIsCentering,
    setIsSeeking,
    setJumpAboveId,
    setJumpBelowId,
    fetchNextPage: () => void fetchNextPage(),
    loadWindowPage,
  });

  const toggleHighlight = useCallback(
    (messageId: number) => {
      const nextIds = toggleHighlightedMessageId(
        highlightedMessageIds,
        messageId,
      );
      const nextParams = new URLSearchParams(searchParams);
      const formatted = formatHighlightedMessageIds(nextIds);
      if (formatted) nextParams.set("messageId", formatted);
      else nextParams.delete("messageId");
      setSearchParams(nextParams, { replace: true });
    },
    [highlightedMessageIds, searchParams, setSearchParams],
  );

  useProductAccessRedirect(error ?? errorTimeline);
  useRealtime(numericTicketId, {
    onTicketMessageActivity: () => {
      if (windowReasonRef.current === "reply") {
        showFullTranscript();
      }
    },
  });

  // Reset on ticket change
  useEffect(() => {
    didInitialScrollRef.current = false;
    centeringRunningRef.current = false;
    centerGenerationRef.current += 1;
    pendingScrollMessageIdRef.current = null;
    pendingReplyJumpFlashIdRef.current = null;
    windowReasonRef.current = null;
    setWindowState(null);
    setReplyJumpFlashMessageId(null);
    setIsSeeking(false);
    setIsCentering(false);
  }, [numericTicketId, setWindowState, windowReasonRef]);

  // Clear window when exiting highlight mode
  useEffect(() => {
    if (hasHighlightedMode) return;
    if (windowReasonRef.current !== "highlight") return;

    windowReasonRef.current = null;
    setWindowState(null);
  }, [hasHighlightedMode, setWindowState, windowReasonRef]);

  // Load window around first highlighted message
  useEffect(() => {
    if (!hasHighlightedMode) return;

    didInitialScrollRef.current = false;
    centeringRunningRef.current = false;
    centerGenerationRef.current += 1;
    pendingScrollMessageIdRef.current = null;

    const firstHighlightedId = sortedHighlightedIds[0];
    if (firstHighlightedId) {
      queueMicrotask(() => {
        void loadWindowAroundMessage(firstHighlightedId, false, "highlight");
      });
    }
  }, [
    hasHighlightedMode,
    highlightKey,
    loadWindowAroundMessage,
    sortedHighlightedIds,
  ]);

  // Update jump targets when content changes
  useEffect(() => {
    if (!contentReady || !hasHighlightedMode) return;

    const frame = requestAnimationFrame(() => {
      updateJumpTargets();
    });

    return () => cancelAnimationFrame(frame);
  }, [
    contentReady,
    hasHighlightedMode,
    updateJumpTargets,
    timelineRenderItems.length,
    windowState?.anchorMessageId,
  ]);

  const scrollToMessage = useCallback(
    (messageId: number) => {
      const existingIndex = findRenderIndexForMessage(messageId);
      if (existingIndex !== -1) {
        centeringRunningRef.current = true;
        pendingScrollMessageIdRef.current = messageId;
        setWindowState((current) =>
          current ? { ...current, anchorMessageId: messageId } : current,
        );
        setIsCentering(true);
        finishPendingHighlightScroll(messageId, true);
        return;
      }

      void loadWindowAroundMessage(messageId, true, "reply");
    },
    [
      findRenderIndexForMessage,
      finishPendingHighlightScroll,
      loadWindowAroundMessage,
      setWindowState,
    ],
  );

  const scrollToReplyTarget = useCallback(
    (messageId: number) => {
      pendingReplyJumpFlashIdRef.current = messageId;
      scrollToMessage(messageId);
    },
    [scrollToMessage],
  );

  const scrollToHighlight = useCallback(
    (messageId: number) => {
      scrollToMessage(messageId);
    },
    [scrollToMessage],
  );

  // --- Render gates ---

  if (session.isPending || !session.data) {
    return <TicketDetailSkeleton />;
  }

  if (isLoadingTicket || (!hasHighlightedMode && isLoadingTimeline)) {
    return <TicketDetailSkeleton />;
  }

  if (error || errorTimeline) {
    const errorMessage = error ?? errorTimeline;
    if (!errorMessage) return <div>Error</div>;
    return <div>Error: {errorMessage.message}</div>;
  }

  if (!ticket || (!hasHighlightedMode && !timelineData)) {
    return <div>No data</div>;
  }

  if (hasHighlightedMode && !windowState) {
    return <TicketDetailSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 p-4">
        <h1 className="text-lg font-semibold mb-2">{ticketDisplayTitle}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>
            Status:{" "}
            <Badge
              variant={ticketStatusBadgeVariant(ticket.status)}
              className="capitalize"
            >
              {ticket.status}
            </Badge>
          </span>
          <span>
            {ticket.participants && ticket.participants.length > 1
              ? "Participants"
              : "User"}
            :{" "}
            {ticket.participants && ticket.participants.length > 0
              ? ticket.participants
                  .map(
                    (participant) =>
                      participant.user?.username ??
                      participant.user?.globalName ??
                      participant.userId,
                  )
                  .join(", ")
              : ticket.userId}
          </span>
          {ticket.hideMemberIdentities ? (
            <Badge variant="outline" className="text-xs">
              Private identities
            </Badge>
          ) : null}
          <span>Opened: {new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
      </header>

      {isReplyTranscriptWindow ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            Viewing a focused excerpt around a replied-to message.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={showFullTranscript}
          >
            Show full transcript
          </Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollArea
          className="size-full"
          viewportClassName="[overflow-anchor:none] [overscroll-behavior:contain]"
          viewportRef={scrollViewportRef}
          onViewportScroll={handleTimelineScroll}
        >
          <div
            ref={rowVirtualizer.containerRef}
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((virtualItem) => {
              const item = timelineRenderItems[virtualItem.index];
              if (!item) return null;

              const isGroupEnd =
                item.kind === "audit" ||
                (item.kind === "message" &&
                  (item.groupPos === "solo" || item.groupPos === "end"));

              return (
                <div
                  key={virtualItem.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualItem.index}
                  className={cn(
                    "absolute top-0 left-0 w-full px-4",
                    isGroupEnd && "pb-4",
                  )}
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {item.kind === "older-sentinel" && (
                    <div
                      className="flex items-center justify-center text-sm text-muted-foreground"
                      style={{ height: TIMELINE_SENTINEL_SIZE_PX }}
                    >
                      {isFetchingNextPage || windowPagingDirection === "older"
                        ? "Loading older activity..."
                        : null}
                    </div>
                  )}

                  {item.kind === "audit" && (
                    <Marker variant="separator">
                      <MarkerContent>{item.label}</MarkerContent>
                    </Marker>
                  )}

                  {item.kind === "message" && (
                    <MessageTimelineRow
                      message={item.message}
                      groupPos={item.groupPos}
                      ticket={ticket}
                      highlighted={highlightedMessageIds.has(item.message.id)}
                      replyJumpFlashing={
                        replyJumpFlashMessageId === item.message.id
                      }
                      onToggleHighlight={toggleHighlight}
                      onScrollToMessage={scrollToReplyTarget}
                      currentUserId={currentUserId}
                    />
                  )}

                  {item.kind === "newer-sentinel" && (
                    <div
                      className="flex items-center justify-center text-sm text-muted-foreground"
                      style={{ height: TIMELINE_SENTINEL_SIZE_PX }}
                    >
                      {windowPagingDirection === "newer"
                        ? "Loading newer activity..."
                        : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {isSeeking && <SeekOverlay />}

        {(jumpAboveId || jumpBelowId) && (
          <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-col gap-2">
            {jumpAboveId && (
              <Button
                type="button"
                variant="default"
                size="icon-sm"
                className="pointer-events-auto shadow-md"
                aria-label="Jump to previous highlighted message"
                onClick={() => void scrollToHighlight(jumpAboveId)}
              >
                <ChevronUp data-icon="inline" />
              </Button>
            )}
            {jumpBelowId && (
              <Button
                type="button"
                variant="default"
                size="icon-sm"
                className="pointer-events-auto shadow-md"
                aria-label="Jump to next highlighted message"
                onClick={() => void scrollToHighlight(jumpBelowId)}
              >
                <ChevronDown data-icon="inline" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}