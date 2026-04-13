import React from "react";
import { api } from "@/services/api";
import { fetchMyCharacter } from "@/services/actorApi";
import type {
  Character,
  ClassRestDetail,
  RaceFeatureDetail,
  BackgroundFeatureDetail,
  FeatFeatureDetail,
  LevelUpFeatDetail,
  InvocationFeatureDetail,
  ClassFeatFeatureDetail,
} from "@/views/character/CharacterViewHelpers";
import { getPrimaryCharacterClassEntry } from "@/views/character/CharacterViewHelpers";

type SpellLookupRow = {
  query: string;
  match: { id: string; name: string; level: number | null; text?: string | null } | null;
};

type FeatLookupRow = {
  id: string;
  feat: FeatFeatureDetail | null;
};

export function useCharacterData(id: string | undefined) {
  const [char, setChar] = React.useState<Character | null>(null);
  const [classDetail, setClassDetail] = React.useState<ClassRestDetail | null>(null);
  const [raceDetail, setRaceDetail] = React.useState<RaceFeatureDetail | null>(null);
  const [backgroundDetail, setBackgroundDetail] = React.useState<BackgroundFeatureDetail | null>(null);
  const [bgOriginFeatDetail, setBgOriginFeatDetail] = React.useState<FeatFeatureDetail | null>(null);
  const [raceFeatDetail, setRaceFeatDetail] = React.useState<FeatFeatureDetail | null>(null);
  const [classFeatDetails, setClassFeatDetails] = React.useState<ClassFeatFeatureDetail[]>([]);
  const [levelUpFeatDetails, setLevelUpFeatDetails] = React.useState<LevelUpFeatDetail[]>([]);
  const [invocationDetails, setInvocationDetails] = React.useState<InvocationFeatureDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const characterData = char?.characterData;
  const primaryClassEntry = getPrimaryCharacterClassEntry(characterData);

  const fetchChar = React.useCallback((): Promise<void> => {
    if (!id) return Promise.resolve();
    return fetchMyCharacter(id)
      .then((next) => setChar(next as Character))
      .catch((e) => setError(e?.message ?? "Failed to load character"))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    fetchChar();
  }, [fetchChar]);

  React.useEffect(() => {
    const classId = primaryClassEntry?.classId;
    if (!classId) {
      setClassDetail(null);
      return;
    }
    let alive = true;
    api<ClassRestDetail>(`/api/compendium/classes/${classId}`)
      .then((detail) => {
        if (alive) setClassDetail(detail ?? null);
      })
      .catch(() => {
        if (alive) setClassDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [primaryClassEntry?.classId]);

  React.useEffect(() => {
    const raceId = characterData?.raceId;
    if (!raceId) {
      setRaceDetail(null);
      return;
    }
    let alive = true;
    api<RaceFeatureDetail>(`/api/compendium/races/${raceId}`)
      .then((detail) => {
        if (alive) setRaceDetail(detail);
      })
      .catch(() => {
        if (alive) setRaceDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.raceId]);

  React.useEffect(() => {
    const bgId = characterData?.bgId;
    if (!bgId) {
      setBackgroundDetail(null);
      return;
    }
    let alive = true;
    api<BackgroundFeatureDetail>(`/api/compendium/backgrounds/${bgId}`)
      .then((detail) => {
        if (alive) setBackgroundDetail(detail);
      })
      .catch(() => {
        if (alive) setBackgroundDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.bgId]);

  React.useEffect(() => {
    const raceFeatId = typeof characterData?.chosenRaceFeatId === "string" ? characterData.chosenRaceFeatId.trim() : "";
    const bgFeatId = typeof characterData?.chosenBgOriginFeatId === "string" ? characterData.chosenBgOriginFeatId.trim() : "";
    const classFeatEntries = Object.entries(characterData?.chosenClassFeatIds ?? {}).filter(
      ([, featId]) => typeof featId === "string" && featId.trim().length > 0,
    );
    const levelUpEntries = Array.isArray(characterData?.chosenLevelUpFeats)
      ? characterData.chosenLevelUpFeats.filter(
          (entry): entry is { level: number; featId: string } =>
            typeof entry?.level === "number"
            && typeof entry?.featId === "string"
            && entry.featId.trim().length > 0,
        )
      : [];

    const ids = Array.from(
      new Set(
        [
          raceFeatId,
          bgFeatId,
          ...classFeatEntries.map(([, featId]) => featId.trim()),
          ...levelUpEntries.map((entry) => entry.featId.trim()),
        ].filter(Boolean),
      ),
    );

    if (ids.length === 0) {
      setRaceFeatDetail(null);
      setBgOriginFeatDetail(null);
      setClassFeatDetails([]);
      setLevelUpFeatDetails([]);
      return;
    }

    let alive = true;
    api<{ rows: FeatLookupRow[] }>("/api/compendium/feats/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((payload) => {
        if (!alive) return;
        const featById = new Map<string, FeatFeatureDetail>();
        for (const row of payload.rows ?? []) {
          if (!row?.id || !row.feat) continue;
          featById.set(String(row.id), row.feat);
        }

        setRaceFeatDetail(raceFeatId ? featById.get(raceFeatId) ?? null : null);
        setBgOriginFeatDetail(bgFeatId ? featById.get(bgFeatId) ?? null : null);
        setClassFeatDetails(
          classFeatEntries.flatMap(([featureName, featId]) => {
            const feat = featById.get(featId);
            return feat ? [{ featureName, feat } satisfies ClassFeatFeatureDetail] : [];
          }),
        );
        setLevelUpFeatDetails(
          levelUpEntries.flatMap(({ level, featId }) => {
            const feat = featById.get(featId);
            return feat ? [{ level, featId, feat } satisfies LevelUpFeatDetail] : [];
          }),
        );
      })
      .catch(() => {
        if (!alive) return;
        setRaceFeatDetail(null);
        setBgOriginFeatDetail(null);
        setClassFeatDetails([]);
        setLevelUpFeatDetails([]);
      });

    return () => {
      alive = false;
    };
  }, [
    characterData?.chosenBgOriginFeatId,
    characterData?.chosenClassFeatIds,
    characterData?.chosenLevelUpFeats,
    characterData?.chosenRaceFeatId,
  ]);

  React.useEffect(() => {
    const chosenInvocationIds = Array.isArray(characterData?.chosenInvocations)
      ? characterData.chosenInvocations.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
    const profInvocationEntries = Array.isArray(characterData?.proficiencies?.invocations)
      ? characterData.proficiencies.invocations.filter((entry) => Boolean(entry)) as { id?: string; name?: string }[]
      : [];
    const invocationRefs = [
      ...chosenInvocationIds.map((entry) => ({ id: entry, name: null as string | null })),
      ...profInvocationEntries.map((entry) => ({
        id: typeof entry.id === "string" && entry.id.trim().length > 0 ? entry.id.trim() : null,
        name: typeof entry.name === "string" && entry.name.trim().length > 0 ? entry.name.trim() : null,
      })),
    ].filter((entry) => entry.id || entry.name);
    if (invocationRefs.length === 0) {
      setInvocationDetails([]);
      return;
    }
    let alive = true;
    (async () => {
        const unresolvedNames = Array.from(
          new Set(
            invocationRefs
              .filter((entry) => !entry.id && entry.name)
              .map((entry) => String(entry.name ?? "").trim())
              .filter(Boolean),
          ),
        );
        const directIds = Array.from(
          new Set(
            invocationRefs
              .map((entry) => String(entry.id ?? "").trim())
              .filter(Boolean),
          ),
        );
        const lookupPayload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: directIds, names: unresolvedNames, includeText: true }),
        });
        const lookupByQuery = new Map(
          (lookupPayload.rows ?? [])
            .filter((row): row is SpellLookupRow => Boolean(row?.query))
            .map((row) => [row.query, row.match] as const),
        );
        return invocationRefs.map((ref) => {
            const detail = ref.id
              ? lookupByQuery.get(ref.id) ?? null
              : ref.name
                ? lookupByQuery.get(ref.name) ?? null
                : null;
            if (!detail) return null;
            const text = Array.isArray(detail.text)
              ? detail.text
                  .map((entry: unknown) => String(entry ?? "").trim())
                  .filter(Boolean)
                  .join("\n")
              : String(detail.text ?? "").trim();
            return {
              id: String(detail?.id ?? ref.id ?? ref.name ?? ""),
              name: String(detail?.name ?? ref.name ?? ref.id ?? ""),
              text,
            } satisfies InvocationFeatureDetail;
          });
      })()
      .then((details) => {
        if (!alive) return;
        const deduped = new Map<string, InvocationFeatureDetail>();
        details
          .filter((detail): detail is InvocationFeatureDetail => Boolean(detail?.text))
          .forEach((detail) => {
            const key = `${detail.id}::${detail.name.toLowerCase()}`;
            if (!deduped.has(key)) deduped.set(key, detail);
          });
        setInvocationDetails(Array.from(deduped.values()));
      })
      .catch(() => {
        if (alive) setInvocationDetails([]);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.chosenInvocations, characterData?.proficiencies?.invocations]);

  return {
    char,
    setChar,
    classDetail,
    raceDetail,
    backgroundDetail,
    bgOriginFeatDetail,
    raceFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    invocationDetails,
    loading,
    error,
    setError,
    fetchChar,
    characterData,
    primaryClassEntry,
  };
}
