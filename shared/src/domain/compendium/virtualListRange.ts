/** Clamp stale scroll positions when filtering reduces a virtual list. */
export function virtualListRange(total: number, scrollTop: number, viewportHeight: number, rowHeight: number, overscan: number) {
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight)) + overscan * 2;
  const start = Math.min(
    Math.max(0, total - visibleCount),
    Math.max(0, Math.floor(scrollTop / rowHeight) - overscan),
  );
  const end = Math.min(total, start + visibleCount);
  return { start, end, padTop: start * rowHeight, padBottom: (total - end) * rowHeight };
}
