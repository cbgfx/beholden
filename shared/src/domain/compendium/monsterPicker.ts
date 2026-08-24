import * as React from "react";

export type CompendiumMonsterRow = {
  id: string;
  ruleset?: "5e" | "5.5e";
  name: string;
  cr?: number | string;
  type?: string;
  environment?: string;
  size?: string; // raw single-letter code: T S M L H G
};

export type SortMode = "az" | "crAsc" | "crDesc";

// Canonical size order for the dropdown.
export const SIZE_LABELS = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] as const;

export function useVirtualList(args: {
  isEnabled: boolean;
  rowHeight: number;
  overscan: number;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!args.isEnabled) return;
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [args.isEnabled]);

  const onScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const getRange = React.useCallback(
    (total: number) => {
      const start = Math.max(0, Math.floor(scrollTop / args.rowHeight) - args.overscan);
      const visibleCount = Math.ceil(viewportH / args.rowHeight) + args.overscan * 2;
      const end = Math.min(total, start + visibleCount);
      return { start, end, padTop: start * args.rowHeight, padBottom: (total - end) * args.rowHeight };
    },
    [scrollTop, viewportH, args.rowHeight, args.overscan]
  );

  const scrollToIndex = React.useCallback(
    (idx: number) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: idx * args.rowHeight, behavior: "smooth" });
    },
    [args.rowHeight]
  );

  return { scrollRef, onScroll, getRange, scrollToIndex, scrollTop, viewportH };
}
