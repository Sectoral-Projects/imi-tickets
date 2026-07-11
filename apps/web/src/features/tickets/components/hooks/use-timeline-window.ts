import { useState, useCallback, useRef, useEffect } from "react";
import {
  fetchTimelineWindow,
  type TimelineWindowDirection,
} from "../../api/timeline";
import type { TimelineItem } from "../../schemas/timeline";
import { timelineItemKey } from "../../utils/timeline/blocks";

export type TimelineWindowState = {
  anchorMessageId: number;
  items: TimelineItem[];
  groupBreakBeforeKeys: string[];
  previousCursor: string | null;
  nextCursor: string | null;
};

export type UseTimelineWindowOptions = {
  ticketId: number;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
  centerGenerationRef: React.MutableRefObject<number>;
  centeringRunningRef: React.MutableRefObject<boolean>;
  pendingScrollMessageIdRef: React.MutableRefObject<number | null>;
  setIsSeeking: (v: boolean) => void;
  setIsCentering: (v: boolean) => void;
};

export function useTimelineWindow(options: UseTimelineWindowOptions) {
  const {
    ticketId,
    scrollViewportRef,
    centerGenerationRef,
    centeringRunningRef,
    pendingScrollMessageIdRef,
    setIsSeeking,
    setIsCentering,
  } = options;

  const windowReasonRef = useRef<"highlight" | "reply" | null>(null);
  const [windowState, setWindowState] = useState<TimelineWindowState | null>(
    null,
  );
  const [windowPagingDirection, setWindowPagingDirection] =
    useState<TimelineWindowDirection | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const showFullTranscript = useCallback(() => {
    windowReasonRef.current = null;
    setWindowState(null);
  }, []);

  const loadWindowAroundMessage = useCallback(
    async (
      messageId: number,
      seek: boolean,
      reason: "highlight" | "reply",
    ) => {
      if (seek) setIsSeeking(true);
      windowReasonRef.current = reason;

      try {
        const result = await fetchTimelineWindow(ticketId, { messageId });

        if (!mountedRef.current) return;

        const viewport = scrollViewportRef.current;
        if (viewport) viewport.scrollTop = 0;

        centerGenerationRef.current += 1;
        centeringRunningRef.current = false;

        pendingScrollMessageIdRef.current = messageId;
        setIsCentering(true);
        setWindowState({
          anchorMessageId: messageId,
          items: result.items,
          groupBreakBeforeKeys: [],
          previousCursor: result.previousCursor,
          nextCursor: result.nextCursor,
        });
      } catch {
        if (!mountedRef.current) return;
        setIsSeeking(false);
        setIsCentering(false);
      }
    },
    [
      ticketId,
      scrollViewportRef,
      centerGenerationRef,
      centeringRunningRef,
      pendingScrollMessageIdRef,
      setIsSeeking,
      setIsCentering,
    ],
  );

  const loadWindowPage = useCallback(
    async (direction: TimelineWindowDirection) => {
      const cursor =
        direction === "older"
          ? windowState?.previousCursor
          : windowState?.nextCursor;
      if (!cursor || windowPagingDirection) return;

      setWindowPagingDirection(direction);
      try {
        const result = await fetchTimelineWindow(ticketId, {
          windowCursor: cursor,
          direction,
        });

        if (!mountedRef.current) return;

        setWindowState((current) => {
          if (!current) return current;

          const boundaryItem =
            direction === "older" ? current.items[0] : result.items[0];
          const boundaryKey = boundaryItem
            ? timelineItemKey(boundaryItem)
            : null;

          return {
            ...current,
            items:
              direction === "older"
                ? [...result.items, ...current.items]
                : [...current.items, ...result.items],
            groupBreakBeforeKeys:
              boundaryKey &&
              !current.groupBreakBeforeKeys.includes(boundaryKey)
                ? [...current.groupBreakBeforeKeys, boundaryKey]
                : current.groupBreakBeforeKeys,
            previousCursor:
              direction === "older"
                ? result.previousCursor
                : current.previousCursor,
            nextCursor:
              direction === "newer" ? result.nextCursor : current.nextCursor,
          };
        });
      } finally {
        if (mountedRef.current) setWindowPagingDirection(null);
      }
    },
    [
      ticketId,
      windowPagingDirection,
      windowState?.nextCursor,
      windowState?.previousCursor,
    ],
  );

  return {
    windowState,
    setWindowState,
    windowPagingDirection,
    windowReasonRef,
    mountedRef,
    showFullTranscript,
    loadWindowAroundMessage,
    loadWindowPage,
  };
}