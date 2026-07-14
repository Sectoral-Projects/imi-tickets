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
import {
  formatHighlightedMessageIds,
  parseHighlightedMessageIds,
  toggleHighlightedMessageId,
} from "../utils/timeline/highlighted-messages";
import { useAuthGate, useProductAccessRedirect } from "@/lib/use-auth-gate";
import { useRealtime } from "@/lib/use-realtime";
import { useClientPreferences } from "@/features/settings/hooks/settings";
import { ticketStatusBadgeVariant } from "../utils/status-badge";
import { resolveTicketDisplayTitle } from "../utils/display-title";
import { TicketDetailSkeleton } from "./ticket-detail-skeleton";
import { TicketHeaderParticipants } from "./ticket-header-participants";
import { MessageGroupCard } from "./message-group-card";
import { TimelineAuditMarker } from "./timeline-audit-marker";
import { useTimelineWindow } from "./hooks/use-timeline-window";
import {
  useTimelineVirtualizer,
} from "./hooks/use-timeline-virtualizer";
import { UnauthorizedScreen } from "@/components/unauthorized-screen";
import { ApiError } from "@/lib/api";

const REPLY_JUMP_FLASH_DURATION_MS = 2000;

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
  // Only deep-link / reload should seed a focused window + scroll. Click toggles
  // of ?messageId= are UI-only and keep the current transcript in place.
  const [openedWithHighlightDeepLink] = useState(highlightKey.length > 0);
  const didBootstrapHighlightWindowRef = useRef(false);
  const currentUserId = session.data?.user?.id ?? null;
  const {
    data: ticket,
    isLoading: isLoadingTicket,
    error,
  } = useTicket(ticketId!);
  const { data: preferences } = useClientPreferences(Boolean(session.data));
  const useChannelNameForTranscript = Boolean(
    preferences?.useChannelNameForTranscript,
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
  } = useTimeline(numericTicketId);

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
  const displayedItems = useMemo(() => {
    if (windowState?.items) return windowState.items;
    // While a deep-link highlight window is loading, keep the full transcript
    // painted instead of blanking into a skeleton.
    return timelineData?.items ?? [];
  }, [windowState, timelineData?.items]);
  const timelineRenderItems = useMemo(() => {
    if (windowState?.blocks) return windowState.blocks;
    return timelineData?.blocks ?? [];
  }, [windowState, timelineData?.blocks]);
  const bootstrappingHighlightWindow =
    openedWithHighlightDeepLink && hasHighlightedMode && !windowState;
  const contentReady =
    !isLoadingTicket &&
    (windowState
      ? true
      : bootstrappingHighlightWindow
        ? Boolean(timelineData)
        : !isLoadingTimeline && Boolean(timelineData));
  const shouldSkipBottomScroll = usesWindowPaging;
  const isReplyTranscriptWindow = usesWindowPaging && !hasHighlightedMode;

  const requestOlderTimelinePage = useCallback(() => {
    return fetchNextPage();
  }, [fetchNextPage]);

  const {
    rowVirtualizer,
    virtualItems,
    findRenderIndexForMessage,
    handleTimelineScroll,
    updateJumpTargets,
    finishPendingHighlightScroll,
    mediaColumnMaxWidth,
  } = useTimelineVirtualizer({
    displayedItems,
    timelineRenderItems,
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
    triggerReplyJumpFlash,
    setIsCentering,
    setIsSeeking,
    setJumpAboveId,
    setJumpBelowId,
    fetchNextPage: requestOlderTimelinePage,
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

  // Reset on ticket change is handled by remounting via key={ticketId} in Ticket.tsx.

  // Clear deep-link highlight window when all highlights are removed
  useEffect(() => {
    if (hasHighlightedMode) return;
    if (windowReasonRef.current !== "highlight") return;

    windowReasonRef.current = null;
    setWindowState(null);
  }, [hasHighlightedMode, setWindowState, windowReasonRef]);

  // Deep-link / reload only: seed a window around the oldest highlighted message
  useEffect(() => {
    if (!hasHighlightedMode) return;
    if (!openedWithHighlightDeepLink) return;
    if (didBootstrapHighlightWindowRef.current) return;

    didBootstrapHighlightWindowRef.current = true;
    didInitialScrollRef.current = false;
    centeringRunningRef.current = false;
    centerGenerationRef.current += 1;
    pendingScrollMessageIdRef.current = null;

    const oldestHighlightedId = sortedHighlightedIds[0];
    if (oldestHighlightedId) {
      queueMicrotask(() => {
        void loadWindowAroundMessage(oldestHighlightedId, false, "highlight");
      });
    }
  }, [
    hasHighlightedMode,
    loadWindowAroundMessage,
    openedWithHighlightDeepLink,
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
      const viewport = scrollViewportRef.current;
      const existingIndex = findRenderIndexForMessage(messageId);

      if (existingIndex !== -1 && viewport) {
        const element = viewport.querySelector(
          `[data-message-id="${messageId}"]`,
        );
        if (element) {
          const elementRect = element.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          const fullyVisible =
            elementRect.top >= viewportRect.top &&
            elementRect.bottom <= viewportRect.bottom;

          if (fullyVisible) {
            triggerReplyJumpFlash(messageId);
            return;
          }
        }
      }

      pendingReplyJumpFlashIdRef.current = messageId;
      scrollToMessage(messageId);
    },
    [
      findRenderIndexForMessage,
      scrollToMessage,
      triggerReplyJumpFlash,
    ],
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
    if (errorMessage instanceof ApiError && errorMessage.code === "FORBIDDEN") {
      return (
        <UnauthorizedScreen description="You need the Read permission to view tickets." />
      );
    }
    return <div>Error: {errorMessage.message}</div>;
  }

  if (!ticket || (!hasHighlightedMode && !timelineData)) {
    return <div>No data</div>;
  }

  // Cold deep-link with ?messageId= and no cached transcript yet — wait for the window.
  if (
    openedWithHighlightDeepLink &&
    hasHighlightedMode &&
    !windowState &&
    !timelineData
  ) {
    return <TicketDetailSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 p-4">
        <h1 className="mb-2 text-lg font-semibold">{ticketDisplayTitle}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            Status
            <Badge
              variant={ticketStatusBadgeVariant(ticket.status)}
              className="capitalize"
            >
              {ticket.status}
            </Badge>
          </span>
          <TicketHeaderParticipants
            participants={ticket.participants}
            fallbackUserId={ticket.userId}
          />
          {ticket.hideMemberIdentities ? (
            <Badge variant="outline" className="text-xs">
              Private identities
            </Badge>
          ) : null}
          <span className="whitespace-nowrap">
            Opened {new Date(ticket.createdAt).toLocaleString()}
          </span>
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
        {/* Native overflow scroller — matches TanStack chat guide.
            Base UI ScrollArea fought end-anchored prepend compensation.
            React-owned sizer height (not directDomUpdates) so height grows in
            the same commit before _willUpdate writes scrollTop. */}
        <div
          ref={scrollViewportRef}
          className="size-full overflow-auto [overflow-anchor:none] [overscroll-behavior:contain]"
          onScroll={handleTimelineScroll}
        >
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((virtualItem) => {
              const item = timelineRenderItems[virtualItem.index];
              if (!item) return null;

              return (
                <div
                  key={virtualItem.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute top-0 left-0 w-full px-4 pb-4"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {item.kind === "audit" && (
                    <TimelineAuditMarker block={item} />
                  )}

                  {item.kind === "messages" && (
                    <MessageGroupCard
                      messages={item.messages}
                      ticket={ticket}
                      highlightedMessageIds={highlightedMessageIds}
                      replyJumpFlashMessageId={replyJumpFlashMessageId}
                      onToggleHighlight={toggleHighlight}
                      onScrollToMessage={scrollToReplyTarget}
                      currentUserId={currentUserId}
                      mediaMaxWidthPx={mediaColumnMaxWidth}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(isFetchingNextPage || windowPagingDirection === "older") && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
            <p className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
              Loading older activity&hellip;
            </p>
          </div>
        )}

        {windowPagingDirection === "newer" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
            <p className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
              Loading newer activity&hellip;
            </p>
          </div>
        )}

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