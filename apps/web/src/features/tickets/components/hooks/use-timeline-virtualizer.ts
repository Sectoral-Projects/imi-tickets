import {
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  measureElement as measureVirtualElement,
  useVirtualizer,
} from "@tanstack/react-virtual";
import type { TimelineItem } from "../../schemas/timeline";
import type { EnrichedMessage } from "../../schemas/messages";
import {
  buildTimelineBlocks,
  flattenTimelineBlocks,
} from "../../utils/timeline/blocks";
import type { FlattenedTimelineRow } from "../../utils/timeline/blocks";
import {
  dedupeEmbedVideoAttachments,
  isEmbedVideoAttachment,
  isHostedVideoUrl,
  isImageMediaUrl,
  shouldRenderInlineMedia,
} from "../../utils/message-media";
import {
  classifyHighlightElement,
  type HighlightPosition,
} from "../../utils/timeline/highlight-navigation";
import type { TimelineWindowState } from "./use-timeline-window";
import type { TimelineWindowDirection } from "../../api/timeline";
import { isJumboEmojiMessage } from "@/lib/twemoji";

// Preload distance from an edge (in px) that triggers a page load.
const EDGE_LOAD_THRESHOLD_PX = 600;
const CENTER_MAX_FRAMES = 300;
const CENTER_TOLERANCE_PX = 4;
const CENTER_STABLE_FRAMES = 2;
const BOTTOM_PIN_STABLE_FRAMES = 3;
const BOTTOM_PIN_MAX_FRAMES = 180;
const ESTIMATED_TEXT_LINE_HEIGHT_PX = 20;
const ESTIMATED_CHARS_PER_LINE = 72;

function estimateTextHeight(content: string) {
  if (!content.trim()) return 0;

  const visualLines = content.split("\n").reduce((count, line) => {
    return count + Math.max(1, Math.ceil(line.length / ESTIMATED_CHARS_PER_LINE));
  }, 0);

  return visualLines * ESTIMATED_TEXT_LINE_HEIGHT_PX;
}

function estimateMessageBodyHeight(message: EnrichedMessage) {
  let height = isJumboEmojiMessage(message.content)
    ? 48
    : estimateTextHeight(message.content);
  const embedVideos = dedupeEmbedVideoAttachments(
    message.attachments.filter(isEmbedVideoAttachment),
  );
  const inlineMedia = message.attachments.filter(
    (attachment) =>
      shouldRenderInlineMedia(attachment) &&
      !isEmbedVideoAttachment(attachment),
  );
  const files = message.attachments.filter(
    (attachment) =>
      !shouldRenderInlineMedia(attachment) &&
      !isEmbedVideoAttachment(attachment),
  );

  const appendSection = (sectionHeight: number) => {
    if (sectionHeight <= 0) return;
    if (height > 0) height += 8;
    height += sectionHeight;
  };

  // Use comfortable upper bounds as recommended by estimateSize. These rows
  // are measured before entering view; the estimate mainly keeps prepend
  // anchoring close while that first measurement is pending.
  appendSection(
    embedVideos.length > 0
      ? embedVideos.length * 420 + (embedVideos.length - 1) * 8
      : 0,
  );
  appendSection(
    inlineMedia.reduce((total, attachment) => {
      const mediaHeight = isImageMediaUrl(attachment.url)
        ? 320
        : isHostedVideoUrl(attachment.url)
          ? 240
          : 0;
      return total + mediaHeight;
    }, 0) + Math.max(0, inlineMedia.length - 1) * 8,
  );
  appendSection(files.length * 20 + Math.max(0, files.length - 1) * 4);

  if (message.isForwarded && height > 0) height += 26;
  return height;
}

function estimateTimelineRowSize(row: TimelineRenderItem) {
  if (row.kind === "audit") return 44;

  const { message, groupPos } = row;
  const isLead = groupPos === "solo" || groupPos === "start";
  const isGroupEnd = groupPos === "solo" || groupPos === "end";
  const bodyHeight = estimateMessageBodyHeight(message);
  const replyHeight = message.replyTo ? 20 : 0;
  const reactionHeight =
    message.reactions.length > 0
      ? Math.ceil(message.reactions.length / 6) * 26
      : 0;
  const outerGroupGap = isGroupEnd ? 16 : 0;

  if (isLead) {
    const contentColumnHeight =
      replyHeight + 20 + 4 + bodyHeight + reactionHeight;
    const avatarColumnHeight = message.replyTo ? 60 : 40;
    const verticalPadding = groupPos === "solo" ? 32 : 20;
    return (
      verticalPadding +
      Math.max(contentColumnHeight, avatarColumnHeight) +
      outerGroupGap
    );
  }

  const verticalPadding = groupPos === "end" ? 20 : 8;
  return (
    verticalPadding +
    replyHeight +
    bodyHeight +
    reactionHeight +
    outerGroupGap
  );
}

export type TimelineRenderItem = FlattenedTimelineRow;

export type UseTimelineVirtualizerOptions = {
  displayedItems: TimelineItem[];
  groupBreakBeforeKeys: ReadonlySet<string>;
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
    groupBreakBeforeKeys,
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

  // Real timeline rows only — no sentinel rows in the virtual list. A stable
  // "older-sentinel" key at index 0 breaks anchorTo:"end" near the top because
  // the anchor key never moves when messages prepend.
  const timelineRows = useMemo(
    () =>
      flattenTimelineBlocks(
        buildTimelineBlocks(displayedItems, groupBreakBeforeKeys),
      ),
    [displayedItems, groupBreakBeforeKeys],
  );
  const timelineRenderItems = timelineRows;

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

  // Stable getItemKey is required for prepend anchoring (TanStack chat guide).
  const getItemKey = useCallback(
    (index: number) => {
      const item = timelineRenderItems[index];
      if (!item) return `idx-${index}`;
      if (item.kind === "audit") return `audit-${item.auditId}`;
      return `message-${item.message.id}`;
    },
    [timelineRenderItems],
  );

  const estimatedSizes = useMemo(
    () => timelineRenderItems.map(estimateTimelineRowSize),
    [timelineRenderItems],
  );
  const estimateSize = useCallback(
    (index: number) => estimatedSizes[index] ?? 96,
    [estimatedSizes],
  );

  // Dynamic rows (especially media) can emit repeated ResizeObserver
  // measurements while the user scrolls backward. Updating cached heights
  // during that gesture moves every following absolute row and causes the
  // well-known TanStack Virtual upward-scroll jitter (#659). Keep the last
  // accepted size until scrolling stops; unseen rows still receive their first
  // real measurement.
  const measureTimelineElement = useCallback(
    (
      element: Element,
      entry: ResizeObserverEntry | undefined,
      instance: Parameters<typeof measureVirtualElement>[2],
    ) => {
      if (instance.scrollDirection === "backward") {
        const index = Number(element.getAttribute("data-index"));
        if (Number.isInteger(index)) {
          const key = instance.options.getItemKey(index);
          const cachedSize = instance.itemSizeCache.get(key);
          if (cachedSize !== undefined) return cachedSize;
        }
      }

      return measureVirtualElement(element, entry, instance);
    },
    [],
  );

  // Match the official chat example + our ticket list: React owns total size and
  // row transforms. directDomUpdates fought ScrollArea scroll sync on prepend.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual owns scroll state outside React memoization.
  const rowVirtualizer = useVirtualizer({
    count: timelineRenderItems.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize,
    getItemKey,
    measureElement: measureTimelineElement,
    overscan: 10,
    useFlushSync: false,
    anchorTo: "end",
    followOnAppend: !usesWindowPaging,
    scrollEndThreshold: 80,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const loadingOlderRef = useRef(false);

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
    findRenderIndexForMessage,
    handleTimelineScroll,
    updateJumpTargets,
    finishPendingHighlightScroll,
    maybeLoadEdges,
  };
}
