import { useEffect, useState } from "react";
import { BacklinkList } from "@beholden/shared/ui/BacklinkList";
import {
  fetchBinderBacklinks,
  type BinderBacklink,
} from "@/services/binderLoreApi";

export function BacklinksPanel(props: { binderId: string; recordId: string }) {
  return (
    <BacklinksContent key={`${props.binderId}:${props.recordId}`} {...props} />
  );
}

function BacklinksContent({
  binderId,
  recordId,
}: {
  binderId: string;
  recordId: string;
}) {
  const [rows, setRows] = useState<BinderBacklink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchBinderBacklinks(binderId, recordId)
      .then((next) => {
        if (active) setRows(next);
      })
      .catch(() => {
        if (active) setError("Could not load backlinks.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [binderId, recordId, retry]);
  return (
    <BacklinkList
      rows={rows}
      targetId={recordId}
      loading={loading}
      error={error}
      onRetry={() => setRetry((value) => value + 1)}
    />
  );
}
