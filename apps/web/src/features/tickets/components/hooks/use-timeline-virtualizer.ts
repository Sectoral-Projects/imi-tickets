import {
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TimelineItem } from "../../schemas/timeline";
import {
  buildTimelineBlocks,
  flattenTimelineBlocks,
} from "../../utils/timeline/blocks";
import type { FlattenedTimelineRow } from "../../utils/timeline/blocks";
import {
  classifyHighlightElement,
  type HighlightPosition,
} from "../../utils/timeline/highlight-navigation";
import type { TimelineWindowState } from "./use-timeline-window";
import type { TimelineWindowDirection } from "../../api/timeline";

// Preload distance from an edge (in px) that triggers a page load.
const EDGE_LOAD_THRESHOLD_PX = 600;
const CENTER_MAX_FRAMES = 300;
const CENTER_TOLERANCE_PX = 4;
const CENTER_STABLE_FRAMES = 2;
const BOTTOM_PIN_STABLE_FRAMES = 3;
const BOTTOM_PIN_MAX_FRAMES = 180;
export const TIMELINE_SENTINEL_SIZE_PX = 40;

export type TimelineRenderItem =
  | { kind: "older-sentinel" }
  | { kind: "newer-sentinel" }
  | FlattenedTimelineRow;

export type UseTimelineVirtualizerOptions = {
  displayedItems: TimelineItem[];
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
  hasHighlightedMode: boolean;
  sortedHighlightedIds: number[];
  windowState: TimelineWindowState | null;
  windowPagingDirection: TimelineWindowDirection | null;
  usesWindowPaging: boolean;
  contentReady: boolean;
  shouldSkipBottomScroll: boolean;
  isCentering: boolean;
  isSeeking: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  numericTicketId: number;
  centerGenerationRef: React.MutableRefObject<number>;
  centeringRunningRef: React.MutableRefObject<boolean>;
  pendingScrollMessageIdRef: React.MutableRefObject<number | null>;
  pendingReplyJumpFlashIdRef: React.MutableRefObject<number | null>;
  didInitialScrollRef: React.MutableRefObject<boolean>;
  triggerReplyJumpFlashRef: React.MutableRefObject<(id: number) => void>;
  setIsCentering: (v: boolean) => void;
  setIsSeeking: (v: boolean) => void;
  setJumpAboveId: (v: number | null) => void;
  setJumpBelowId: (v: number | null) => void;
  fetchNextPage: () => void;
  loadWindowPage: (dir: TimelineWindowDirection) => Promise<void>;
};

export function useTimelineVirtualizer(opts: UseTimelineVirtualizerOptions) {
  const {
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
    hasNextPage,
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
    fetchNextPage,
    loadWindowPage,
  } = opts;

  const timelineRows = useMemo(
    () => flattenTimelineBlocks(buildTimelineBlocks(displayedItems)),
    [displayedItems],
  );

  const timelineRenderItems = useMemo<TimelineRenderItem[]>(() => {
    const items: TimelineRenderItem[] = [];

    if (
      (usesWindowPaging && windowState?.previousCursor) ||
      (!usesWindowPaging && hasNextPage)
    ) {
      items.push({ kind: "older-sentinel" });
    }

    items.push(...timelineRows);

    if (usesWindowPaging && windowState?.nextCursor) {
      items.push({ kind: "newer-sentinel" });
    }

    return items;
  }, [
    hasNextPage,
    timelineRows,
    usesWindowPaging,
    windowState?.nextCursor,
    windowState?.previousCursor,
  ]);

  const loadedMessageIdBounds = useMemo(() => {
    let first: number | null = null;
    let last: number | null = null;
    for (const item of displayedItems) {
      if (item.kind !== "message") continue;
      if (first === null) first = item.message.id;
      last = item.message.id;
    }
    return { first, last };
  }, [displayedItems]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual owns scroll state outside React memoization.
  const rowVirtualizer = useVirtualizer({
    count: timelineRenderItems.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize: (index) => {
      const item = timelineRenderItems[index];
      if (!item) return 96;
      if (item.kind === "older-sentinel" || item.kind === "newer-sentinel") {
        return TIMELINE_SENTINEL_SIZE_PX;
      }
      if (item.kind === "audit") return 44;
      const isLead = item.groupPos === "solo" || item.groupPos === "start";
      const replyExtra = item.message.replyTo ? 28 : 0;
      const reactionExtra = (item.message.reactions?.length ?? 0) > 0 ? 28 : 0;
      const groupGap =
        item.groupPos === "solo" || item.groupPos === "end" ? 16 : 0;
      return (isLead ? 112 : 52) + replyExtra + reactionExtra + groupGap;
    },
    getItemKey: (index) => {
      const item = timelineRenderItems[index];
      if (!item) return `idx-${index}`;
      if (item.kind === "older-sentinel") return "older-sentinel";
      if (item.kind === "newer-sentinel") return "newer-sentinel";
      if (item.kind === "audit") return `audit-${item.auditId}`;
      return `message-${item.message.id}`;
    },
    overscan: 8,
    useFlushSync: true,
    directDomUpdates: true,
    anchorTo: "end",
    followOnAppend: !hasHighlightedMode,
    scrollEndThreshold: 80,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const findRenderIndexForMessage = useCallback(
    (messageId: number) =>
      timelineRenderItems.findIndex(
        (item) => item.kind === "message" && item.message.id === messageId,
      ),
    [timelineRenderItems],
  );

  const updateJumpTargets = useCallback(() => {
    if (!hasHighlightedMode || sortedHighlightedIds.length < 2) {
      setJumpAboveId(null);
      setJumpBelowId(null);
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const viewTop = viewport.scrollTop;
    const viewBottom = viewTop + viewport.clientHeight;

    let above: number | null = null;
    let below: number | null = null;

    for (const id of sortedHighlightedIds) {
      let position: HighlightPosition | null = null;

      const element = viewport.querySelector(`[data-message-id="${id}"]`);
      if (element) {
        position = classifyHighlightElement(element, viewport);
      } else {
        const renderIndex = findRenderIndexForMessage(id);
        if (renderIndex !== -1) {
          const measurement = rowVirtualizer.measurementsCache[renderIndex];
          if (measurement) {
            position =
              measurement.end <= viewTop
                ? "above"
                : measurement.start >= viewBottom
                  ? "below"
                  : "visible";
          }
        } else if (
          loadedMessageIdBounds.first !== null &&
          id < loadedMessageIdBounds.first
        ) {
          position = "above";
        } else if (
          loadedMessageIdBounds.last !== null &&
          id > loadedMessageIdBounds.last
        ) {
          position = "below";
        }
      }

      if (position === "above") above = id;
      else if (position === "below" && below === null) below = id;
    }

    setJumpAboveId(above);
    setJumpBelowId(below);
  }, [
    findRenderIndexForMessage,
    hasHighlightedMode,
    loadedMessageIdBounds,
    rowVirtualizer,
    sortedHighlightedIds,
    scrollViewportRef,
    setJumpAboveId,
    setJumpBelowId,
  ]);

  const maybeLoadEdges = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || isCentering || isSeeking) return;

    const distanceFromTop = viewport.scrollTop;
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (hasHighlightedMode || usesWindowPaging) {
      if (!windowState || windowPagingDirection) return;

      if (
        windowState.previousCursor &&
        distanceFromTop <= EDGE_LOAD_THRESHOLD_PX
      ) {
        void loadWindowPage("older");
        return;
      }
      if (
        windowState.nextCursor &&
        distanceFromBottom <= EDGE_LOAD_THRESHOLD_PX
      ) {
        void loadWindowPage("newer");
      }
      return;
    }

    if (!didInitialScrollRef.current || isFetchingNextPage || !hasNextPage)
      return;

    if (distanceFromTop <= EDGE_LOAD_THRESHOLD_PX) {
      void fetchNextPage();
    }
  }, [
    scrollViewportRef,
    isCentering,
    isSeeking,
    hasHighlightedMode,
    usesWindowPaging,
    windowState,
    windowPagingDirection,
    loadWindowPage,
    didInitialScrollRef,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  ]);

  const handleTimelineScroll = useCallback(() => {
    updateJumpTargets();
    maybeLoadEdges();
  }, [maybeLoadEdges, updateJumpTargets]);

  const finishPendingHighlightScroll = useCallback(
    (messageId: number, smooth: boolean) => {
      const generation = ++centerGenerationRef.current;
      let frame = 0;
      let stableFrames = 0;
      let issuedInitialScroll = false;
      let lastDelta: number | null = null;
      let rafId: number | null = null;

      const finalize = (flashOpts?: { flashReplyJump?: boolean }) => {
        if (pendingReplyJumpFlashIdRef.current === messageId) {
          if (flashOpts?.flashReplyJump) {
            triggerReplyJumpFlashRef.current(messageId);
          }
          pendingReplyJumpFlashIdRef.current = null;
        }

        pendingScrollMessageIdRef.current = null;
        centeringRunningRef.current = false;
        didInitialScrollRef.current = true;
        setIsCentering(false);
        setIsSeeking(false);
        updateJumpTargets();
      };

      const step = () => {
        if (generation !== centerGenerationRef.current) return;

        frame += 1;
        if (frame >= CENTER_MAX_FRAMES) {
          finalize();
          return;
        }

        const viewport = scrollViewportRef.current;
        if (!viewport) {
          rafId = requestAnimationFrame(step);
          return;
        }

        const element = viewport.querySelector(
          `[data-message-id="${messageId}"]`,
        );
        if (!element) {
          const targetIndex = findRenderIndexForMessage(messageId);
          if (targetIndex === -1) {
            finalize();
            return;
          }

          if (!issuedInitialScroll || !smooth) {
            issuedInitialScroll = true;
            rowVirtualizer.scrollToIndex(targetIndex, {
              align: "center",
              behavior: smooth ? "smooth" : "auto",
            });
          }

          lastDelta = null;
          rafId = requestAnimationFrame(step);
          return;
        }

        issuedInitialScroll = true;

        const elementRect = element.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const delta =
          elementRect.top +
          elementRect.height / 2 -
          (viewportRect.top + viewportRect.height / 2);

        if (Math.abs(delta) <= CENTER_TOLERANCE_PX) {
          stableFrames += 1;
          if (stableFrames >= CENTER_STABLE_FRAMES) {
            finalize({ flashReplyJump: true });
            return;
          }
        } else {
          stableFrames = 0;
          const motionEnded =
            lastDelta !== null && Math.abs(delta - lastDelta) < 1;
          if (!smooth || motionEnded) {
            rowVirtualizer.scrollBy(delta, { behavior: "auto" });
          }
        }

        lastDelta = delta;
        rafId = requestAnimationFrame(step);
      };

      rafId = requestAnimationFrame(step);

      // Return cleanup for unmount safety
      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    },
    [
      centerGenerationRef,
      centeringRunningRef,
      didInitialScrollRef,
      findRenderIndexForMessage,
      pendingReplyJumpFlashIdRef,
      pendingScrollMessageIdRef,
      rowVirtualizer,
      scrollViewportRef,
      setIsCentering,
      setIsSeeking,
      triggerReplyJumpFlashRef,
      updateJumpTargets,
    ],
  );

  // After window seed/replace or page load, re-check edges
  useEffect(() => {
    if (isCentering || isSeeking || !contentReady) return;
    const frameId = requestAnimationFrame(() => maybeLoadEdges());
    return () => cancelAnimationFrame(frameId);
  }, [contentReady, isCentering, isSeeking, maybeLoadEdges, windowState]);

  // Belt-and-braces: virtualizer range change also checks edges
  const firstVirtualIndex = virtualItems[0]?.index ?? null;
  const lastVirtualIndex = virtualItems.at(-1)?.index ?? null;
  useEffect(() => {
    if (firstVirtualIndex === null || lastVirtualIndex === null) return;
    maybeLoadEdges();
  }, [firstVirtualIndex, lastVirtualIndex, maybeLoadEdges]);

  // Normal-mode initial bottom pin
  useLayoutEffect(() => {
    if (!contentReady || shouldSkipBottomScroll || didInitialScrollRef.current)
      return;
    if (timelineRenderItems.length === 0) return;

    let cancelled = false;
    let frame = 0;
    let stableFrames = 0;

    const pinToEnd = () => {
      if (cancelled || didInitialScrollRef.current) return;

      frame += 1;
      const viewport = scrollViewportRef.current;
      if (viewport) {
        const distanceFromBottom =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

        if (distanceFromBottom > 1) {
          rowVirtualizer.scrollToEnd();
          stableFrames = 0;
        } else {
          stableFrames += 1;
        }

        if (
          stableFrames >= BOTTOM_PIN_STABLE_FRAMES ||
          frame >= BOTTOM_PIN_MAX_FRAMES
        ) {
          didInitialScrollRef.current = true;
          return;
        }
      }

      requestAnimationFrame(pinToEnd);
    };

    pinToEnd();

    return () => {
      cancelled = true;
    };
  }, [
    contentReady,
    shouldSkipBottomScroll,
    numericTicketId,
    rowVirtualizer,
    timelineRenderItems.length,
    didInitialScrollRef,
    scrollViewportRef,
  ]);

  // Pending highlight center layout effect
  const cleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!contentReady) return;

    if (pendingScrollMessageIdRef.current !== null) {
      if (!centeringRunningRef.current) {
        centeringRunningRef.current = true;
        cleanupRef.current = finishPendingHighlightScroll(
          pendingScrollMessageIdRef.current,
          false,
        ) ?? null;
      }
      return;
    }
  }, [
    contentReady,
    displayedItems,
    finishPendingHighlightScroll,
    timelineRenderItems.length,
    centeringRunningRef,
    pendingScrollMessageIdRef,
  ]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return {
    rowVirtualizer,
    virtualItems,
    timelineRenderItems,
    timelineRows,
    loadedMessageIdBounds,
    findRenderIndexForMessage,
    handleTimelineScroll,
    updateJumpTargets,
    finishPendingHighlightScroll,
    maybeLoadEdges,
  };
}