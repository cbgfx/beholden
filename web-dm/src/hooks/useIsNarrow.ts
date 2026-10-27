import * as React from "react";

export function useIsNarrow(query = "(max-width: 980px)") {
  const [isNarrow, setIsNarrow] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsNarrow(Boolean(mq.matches));
    onChange();
    mq.addEventListener?.("change", onChange);
    // Safari fallback
    mq.addListener?.(onChange);
    return () => {
      mq.removeEventListener?.("change", onChange);
      mq.removeListener?.(onChange);
    };
  }, [query]);

  return isNarrow;
}
