import React from "react";

/** Distance from the bottom, in pixels, at which the next page starts loading. */
const LOAD_THRESHOLD_PX = 320;

type InfiniteScrollOptions = {
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  /**
   * Scroll container to watch. Pass the ref you already have when the list owns one (a virtualised
   * list, say); otherwise use the `containerRef` this hook returns.
   */
  containerRef?: React.RefObject<HTMLDivElement | null>;
};

/**
 * Turns a scrollable list container into a paging one.
 *
 * Returns an onScroll handler for the scroll container and a ref for that same element. The ref
 * covers the case the handler cannot: when the first page doesn't fill the viewport there is
 * nothing to scroll, and without a nudge the list would sit there looking complete when it isn't.
 */
export function useInfiniteScroll(options: InfiniteScrollOptions) {
  const { hasMore, loadingMore, loadMore, containerRef: externalRef } = options;
  const ownRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = externalRef ?? ownRef;

  const maybeLoadMore = React.useCallback((element: HTMLElement | null) => {
    if (!element || !hasMore || loadingMore) return;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= LOAD_THRESHOLD_PX) loadMore();
  }, [hasMore, loadMore, loadingMore]);

  const onScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    maybeLoadMore(event.currentTarget);
  }, [maybeLoadMore]);

  React.useEffect(() => {
    maybeLoadMore(containerRef.current);
  }, [containerRef, maybeLoadMore]);

  return { containerRef, onScroll };
}
