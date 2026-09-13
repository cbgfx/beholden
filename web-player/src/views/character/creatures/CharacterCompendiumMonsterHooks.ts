import { useEffect, useState } from "react";
import { api } from "@/services/api";

export function useCompendiumMonster(monsterId: string | null | undefined, missingMessage: string) {
  const [monster, setMonster] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!monsterId) {
      setMonster(null);
      setBusy(false);
      setError(null);
      return;
    }
    let alive = true;
    setBusy(true);
    setError(null);
    api<any>(`/api/compendium/monsters/${encodeURIComponent(monsterId)}`)
      .then((data) => { if (alive) setMonster(data); })
      .catch((e) => {
        if (alive) {
          setMonster(null);
          setError(e?.message ?? missingMessage);
        }
      })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [monsterId, missingMessage]);

  return { monster, busy, error };
}
