import { useEffect } from "react";

export function useDebouncedEffect(effect: () => void | Promise<void>, delayMs: number): void {
  useEffect(() => {
    const timer = window.setTimeout(() => void effect(), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, effect]);
}
