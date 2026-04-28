import React from "react";
import { api } from "@/services/api";
import type {
  LevelUpFeatSelection,
  LevelUpFeatDetail,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type {
  ParsedFeatLike as ParsedFeat,
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";

export function useCharacterCreatorFeatDetails(args: {
  chosenRaceFeatId: string | null;
  chosenBgOriginFeatId: string | null;
  chosenClassFeatIds: Record<string, string>;
  chosenLevelUpFeats: LevelUpFeatSelection[];
  setRaceFeatDetail: React.Dispatch<React.SetStateAction<BackgroundFeat | null>>;
  setBgOriginFeatDetail: React.Dispatch<React.SetStateAction<BackgroundFeat | null>>;
  setClassFeatDetails: React.Dispatch<React.SetStateAction<Record<string, BackgroundFeat>>>;
  setLevelUpFeatDetails: React.Dispatch<React.SetStateAction<LevelUpFeatDetail[]>>;
  setFeatDetailCache: React.Dispatch<React.SetStateAction<Record<string, BackgroundFeat>>>;
}) {
  const {
    chosenRaceFeatId,
    chosenBgOriginFeatId,
    chosenClassFeatIds,
    chosenLevelUpFeats,
    setRaceFeatDetail,
    setBgOriginFeatDetail,
    setClassFeatDetails,
    setLevelUpFeatDetails,
    setFeatDetailCache,
  } = args;

  React.useEffect(() => {
    const raceFeatId = typeof chosenRaceFeatId === "string" ? chosenRaceFeatId.trim() : "";
    const bgFeatId = typeof chosenBgOriginFeatId === "string" ? chosenBgOriginFeatId.trim() : "";
    const classFeatEntries = Object.entries(chosenClassFeatIds).filter(
      ([, featId]) => typeof featId === "string" && featId.trim().length > 0,
    ) as [string, string][];
    const levelUpFeatEntries = chosenLevelUpFeats.filter(
      (entry): entry is { level: number; featId: string } =>
        typeof entry?.level === "number"
        && typeof entry?.featId === "string"
        && entry.featId.trim().length > 0,
    );
    const ids = Array.from(
      new Set(
        [
          raceFeatId,
          bgFeatId,
          ...classFeatEntries.map(([, featId]) => featId.trim()),
          ...levelUpFeatEntries.map((entry) => entry.featId.trim()),
        ].filter(Boolean),
      ),
    );

    if (ids.length === 0) {
      setRaceFeatDetail(null);
      setBgOriginFeatDetail(null);
      setClassFeatDetails({});
      setLevelUpFeatDetails([]);
      return;
    }

    let cancelled = false;
    api<{ rows: Array<{ id: string; feat: ({ name: string; text?: string; parsed: ParsedFeat } & Record<string, unknown>) | null }> }>(
      "/api/compendium/feats/lookup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    )
      .then((payload) => {
        if (cancelled) return;
        const detailById = new Map<string, { id: string; name: string; text?: string; parsed: ParsedFeat }>();
        for (const row of payload.rows ?? []) {
          if (!row?.id || !row?.feat) continue;
          detailById.set(String(row.id), {
            id: String(row.id),
            name: String(row.feat.name ?? ""),
            text: typeof row.feat.text === "string" ? row.feat.text : undefined,
            parsed: row.feat.parsed as ParsedFeat,
          });
        }

        setFeatDetailCache((prev) => {
          const next = { ...prev };
          for (const [featId, detail] of detailById.entries()) next[featId] = detail;
          return next;
        });

        setRaceFeatDetail(raceFeatId ? detailById.get(raceFeatId) ?? null : null);
        setBgOriginFeatDetail(bgFeatId ? detailById.get(bgFeatId) ?? null : null);
        setClassFeatDetails(
          Object.fromEntries(
            classFeatEntries.flatMap(([featureName, featId]) => {
              const detail = detailById.get(featId);
              return detail ? [[featureName, detail] as const] : [];
            }),
          ),
        );
        setLevelUpFeatDetails(
          levelUpFeatEntries.flatMap(({ level, featId }) => {
            const detail = detailById.get(featId);
            return detail ? [{ level, featId, feat: detail } satisfies LevelUpFeatDetail] : [];
          }),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setRaceFeatDetail(null);
        setBgOriginFeatDetail(null);
        setClassFeatDetails({});
        setLevelUpFeatDetails([]);
      });

    return () => { cancelled = true; };
  }, [
    chosenBgOriginFeatId,
    chosenClassFeatIds,
    chosenLevelUpFeats,
    chosenRaceFeatId,
    setBgOriginFeatDetail,
    setClassFeatDetails,
    setFeatDetailCache,
    setLevelUpFeatDetails,
    setRaceFeatDetail,
  ]);
}
