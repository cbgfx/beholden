import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Page/scroll state is local presentation state, never a character-data write. */
export function useColumnNavigation(
  scope: string,
  columns: number,
  compact: boolean,
  scroll: RefObject<HTMLDivElement | null>,
) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const positions = useRef(new Map<string, number>());
  const active = Math.min(Math.max(0, selected[scope] ?? 0), columns - 1);
  const key = `${scope}:${active}`;
  useLayoutEffect(() => {
    const node = scroll.current;
    if (!compact || !node) return;
    node.scrollTop = positions.current.get(key) ?? 0;
    const record = () => positions.current.set(key, node.scrollTop);
    node.addEventListener("scroll", record);
    return () => node.removeEventListener("scroll", record);
  }, [key, compact, scroll]);
  return {
    active,
    select: (index: number) => {
      if (scroll.current) positions.current.set(key, scroll.current.scrollTop);
      setSelected((current) => ({
        ...current,
        [scope]: Math.max(0, Math.min(columns - 1, index)),
      }));
    },
  };
}
