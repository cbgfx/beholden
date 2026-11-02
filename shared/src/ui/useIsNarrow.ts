import { useEffect, useState } from "react";

/** Match a layout breakpoint without subscribing to every viewport resize. */
export function useIsNarrow(query = "(max-width: 980px)") {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setIsNarrow(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return isNarrow;
}
