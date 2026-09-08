import { useEffect, useState } from "react";

export function useBinderResource<T>(binderId: string, load: (binderId: string) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void load(binderId).then((value) => {
      if (!cancelled) setData(value);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load Binder data.");
    });
    return () => { cancelled = true; };
  }, [binderId, load]);
  return { data, error };
}
