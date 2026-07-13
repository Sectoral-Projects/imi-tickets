import {
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TimelineItem } from "../../schemas/timeline";
import {
  assertStableBlockPrepend,
  timelineBlockKey,
  type TimelineBlock,
} from "../../utils/timeline/blocks";
import { estimateTimelineBlockSize } from "../../utils/timeline/estimate-row-size";
import { TRANSCRIPT_MEDIA_COLUMN_CHROME_PX } from "../../utils/message-media";
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
const DEFAULT_MEDIA_COLUMN_MAX_WIDTH_PX = 480;

export type TimelineRenderItem = TimelineBlock;

export type UseTimelineVirtualizerOptions = {
  displayedItems: TimelineItem[];
  /** Finalized per-page blocks — do not rebuild across the full list. */
  timelineRenderItems: TimelineBlock[];
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
  triggerReplyJumpFlash: (id: number) => void;
  setIsCentering: (v: boolean) => void;
  setIsSeeking: (v: boolean) => void;
  setJumpAboveId: (v: number | null) => void;
  setJumpBelowId: (v: number | null) => void;
  fetchNextPage: () => void | Promise<unknown>;
  loadWindowPage: (dir: TimelineWindowDirection) => Promise<void>;
};

export function useTimelineVirtualizer(opts: UseTimelineVirtualizerOptions) {
  const {
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
    hasNextPage,
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
    fetchNextPage,
    loadWindowPage,
  } = opts;

  // Immutable page blocks are the virtualizer input. Prepends grow the list
  // with new keys only — never rebuild existing groups across pages.
  const timelineRows = timelineRenderItems;
  const prevBlocksRef = useRef<TimelineBlock[]>([]);
  const listIdentityRef = useRef({
    ticketId: numericTicketId,
    usesWindowPaging,
    anchorMessageId: windowState?.anchorMessageId ?? null,
  });

  useEffect(() => {
    const identity = listIdentityRef.current;
    const identityChanged =
      identity.ticketId !== numericTicketId ||
      identity.usesWindowPaging !== usesWindowPaging ||
      identity.anchorMessageId !== (windowState?.anchorMessageId ?? null);

    if (identityChanged) {
      listIdentityRef.current = {
        ticketId: numericTicketId,
        usesWindowPaging,
        anchorMessageId: windowState?.anchorMessageId ?? null,
      };
      prevBlocksRef.current = timelineRenderItems;
      return;
    }

    assertStableBlockPrepend(prevBlocksRef.current, timelineRenderItems);
    prevBlocksRef.current = timelineRenderItems;
  }, [
    timelineRenderItems,
    numericTicketId,
    usesWindowPaging,
    windowState?.anchorMessageId,
  ]);

  const [mediaColumnMaxWidth, setMediaColumnMaxWidth] = useState(
    DEFAULT_MEDIA_COLUMN_MAX_WIDTH_PX,
  );

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const sync = () => {
      const next = Math.max(
        160,
        Math.floor(viewport.clientWidth - TRANSCRIPT_MEDIA_COLUMN_CHROME_PX),
      );
      setMediaColumnMaxWidth((prev) => (prev === next ? prev : next));
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [scrollViewportRef, contentReady]);

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

  const getItemKey = useCallback(
    (index: number) => {
      const item = timelineRenderItems[index];
      if (!item) {
        throw new Error(
          `Missing timeline block at virtual index ${index} (count=${timelineRenderItems.length}). Index keys are not allowed.`,
        );
      }
      return timelineBlockKey(item);
    },
    [timelineRenderItems],
  );

  const loadingOlderRef = useRef(false);

  const estimatedSizes = useMemo(
    () =>
      timelineRenderItems.map((block) =>
        estimateTimelineBlockSize(block, mediaColumnMaxWidth),
      ),
    [timelineRenderItems, mediaColumnMaxWidth],
  );
  const estimateSize = useCallback(
    (index: number) => estimatedSizes[index] ?? 96,
    [estimatedSizes],
  );

  // Official chat guide: anchorTo end + React-owned sizer height/transform.
  // Do NOT use directDomUpdates here — its applyDirectStyles runs AFTER
  // _willUpdate's scrollTop write, so a large prepend clamps scrollTop to the
  // old max and shoves the viewport into newly loaded older messages.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual owns scroll state outside React memoization.
  const rowVirtualizer = useVirtualizer({
    count: timelineRenderItems.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize,
    getItemKey,
    overscan: 6,
    useFlushSync: false,
    anchorTo: "end",
    followOnAppend: !usesWindowPaging,
    scrollEndThreshold: 80,
  });

  useLayoutEffect(() => {
    const previous =
      rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange;
    const compensateAboveViewport: NonNullable<
      typeof rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange
    > = (item, _delta, instance) =>
      item.start < (instance.scrollOffset ?? 0);

    // Work around https://github.com/TanStack/virtual/issues/1227; remove this
    // direct instance assignment once upstream wires the option correctly.
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange =
      compensateAboveViewport;
    return () => {
      if (
        rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange ===
        compensateAboveViewport
      ) {
        rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = previous;
      }
    };
  }, [rowVirtualizer]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  const findRenderIndexForMessage = useCallback(
    (messageId: number) =>
      timelineRenderItems.findIndex(
        (item) =>
          item.kind === "messages" &&
          item.messages.some((message) => message.id === messageId),
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

    if (usesWindowPaging) {
      if (!windowState || windowPagingDirection || loadingOlderRef.current)
        return;

      if (
        windowState.previousCursor &&
        distanceFromTop <= EDGE_LOAD_THRESHOLD_PX
      ) {
        loadingOlderRef.current = true;
        void loadWindowPage("older").finally(() => {
          loadingOlderRef.current = false;
        });
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

    if (
      !didInitialScrollRef.current ||
      loadingOlderRef.current ||
      isFetchingNextPage ||
      !hasNextPage
    ) {
      return;
    }

    if (distanceFromTop <= EDGE_LOAD_THRESHOLD_PX) {
      loadingOlderRef.current = true;
      void Promise.resolve(fetchNextPage()).finally(() => {
        loadingOlderRef.current = false;
      });
    }
  }, [
    scrollViewportRef,
    isCentering,
    isSeeking,
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

      const finalize = () => {
        if (pendingReplyJumpFlashIdRef.current === messageId) {
          triggerReplyJumpFlash(messageId);
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
            finalize();
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
      triggerReplyJumpFlash,
      updateJumpTargets,
    ],
  );

  // Re-check edges once after window data changes (content already at an edge).
  // Do NOT drive loads off virtual index range — that races prepend anchoring.
  useEffect(() => {
    if (isCentering || isSeeking || !contentReady) return;
    const frameId = requestAnimationFrame(() => maybeLoadEdges());
    return () => cancelAnimationFrame(frameId);
  }, [contentReady, isCentering, isSeeking, maybeLoadEdges, windowState]);

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

  const cleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!contentReady) return;

    if (pendingScrollMessageIdRef.current !== null) {
      if (!centeringRunningRef.current) {
        centeringRunningRef.current = true;
        cleanupRef.current =
          finishPendingHighlightScroll(
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
    mediaColumnMaxWidth,
    findRenderIndexForMessage,
    handleTimelineScroll,
    updateJumpTargets,
    finishPendingHighlightScroll,
    maybeLoadEdges,
  };
}
