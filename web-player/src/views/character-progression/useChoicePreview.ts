import { useEffect, useState } from "react";

/** Filtering may hide a preview; removing an option must reset it. */
export function useChoicePreview<T extends { id: string }>(items: T[], visibleItems = items) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeItem = visibleItems.find((item) => item.id === activeId)
    ?? items.find((item) => item.id === activeId)
    ?? visibleItems[0] ?? items[0] ?? null;

  useEffect(() => {
    if (!activeItem) {
      if (activeId !== null) setActiveId(null);
    } else if (activeId === null || !items.some((item) => item.id === activeId)) {
      setActiveId(activeItem.id);
    }
  }, [activeId, activeItem, items]);

  return { activeItem, setActiveId };
}
