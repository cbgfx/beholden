import React from "react";
import { api } from "@/services/api";
import { fetchMyCharacter } from "@/services/actorApi";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
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
  match: { id: string; name: string; level: number | null } | null;
};

export function useCharacterData(id: string | undefined, polymorphDrawerOpen: boolean) {
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
  const [polymorphRows, setPolymorphRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [polymorphRowsBusy, setPolymorphRowsBusy] = React.useState(false);
  const [polymorphRowsError, setPolymorphRowsError] = React.useState<string | null>(null);

  const characterData = char?.characterData;
  const primaryClassEntry = getPrimaryCharacterClassEntry(characterData);

  const fetchChar = React.useCallback(() => {
    if (!id) return;
    fetchMyCharacter(id)
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
    if (!polymorphDrawerOpen || polymorphRows.length > 0) return;
    let alive = true;
    setPolymorphRowsBusy(true);
    setPolymorphRowsError(null);
    api<CompendiumMonsterRow[]>("/api/compendium/monsters")
      .then((rows) => {
        if (alive) setPolymorphRows(rows);
      })
      .catch((e) => {
        if (alive) setPolymorphRowsError(e?.message ?? "Failed to load creatures.");
      })
      .finally(() => {
        if (alive) setPolymorphRowsBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [polymorphDrawerOpen, polymorphRows.length]);

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
    const featId = characterData?.chosenRaceFeatId;
    if (!featId) {
      setRaceFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => {
        if (alive) setRaceFeatDetail(detail);
      })
      .catch(() => {
        if (alive) setRaceFeatDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.chosenRaceFeatId]);

  React.useEffect(() => {
    const featId = characterData?.chosenBgOriginFeatId;
    if (!featId) {
      setBgOriginFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => {
        if (alive) setBgOriginFeatDetail(detail);
      })
      .catch(() => {
        if (alive) setBgOriginFeatDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.chosenBgOriginFeatId]);

  React.useEffect(() => {
    const entries = Object.entries(characterData?.chosenClassFeatIds ?? {}).filter(
      ([, featId]): featId is string => typeof featId === "string" && featId.trim().length > 0,
    );
    if (entries.length === 0) {
      setClassFeatDetails([]);
      return;
    }
    let alive = true;
    Promise.all(
      entries.map(async ([featureName, featId]) => {
        const feat = await api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`);
        return { featureName, feat };
      }),
    )
      .then((details) => {
        if (alive) setClassFeatDetails(details);
      })
      .catch(() => {
        if (alive) setClassFeatDetails([]);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.chosenClassFeatIds]);

  React.useEffect(() => {
    const entries = Array.isArray(characterData?.chosenLevelUpFeats)
      ? characterData.chosenLevelUpFeats.filter(
          (entry): entry is { level: number; featId: string } =>
            typeof entry?.level === "number" &&
            typeof entry?.featId === "string" &&
            entry.featId.trim().length > 0,
        )
      : [];
    if (entries.length === 0) {
      setLevelUpFeatDetails([]);
      return;
    }
    let alive = true;
    Promise.all(
      entries.map(async ({ level, featId }) => {
        const detail = await api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`);
        return { level, featId, feat: detail } satisfies LevelUpFeatDetail;
      }),
    )
      .then((details) => {
        if (alive) setLevelUpFeatDetails(details);
      })
      .catch(() => {
        if (alive) setLevelUpFeatDetails([]);
      });
    return () => {
      alive = false;
    };
  }, [characterData?.chosenLevelUpFeats]);

  React.useEffect(() => {
    const chosenInvocationIds = Array.isArray(characterData?.chosenInvocations)
      ? characterData.chosenInvocations.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
    const profInvocationEntries = Array.isArray(characterData?.proficiencies?.invocations)
      ? characterData.proficiencies.invocations.filter((entry): entry is { id?: string; name?: string } => Boolean(entry))
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
        const lookupByName = new Map<string, string>();
        if (unresolvedNames.length > 0) {
          try {
            const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ names: unresolvedNames }),
            });
            for (const row of payload.rows ?? []) {
              if (row?.query && row?.match?.id) lookupByName.set(row.query, row.match.id);
            }
          } catch {
            // ignore
          }
        }
        return Promise.all(
          invocationRefs.map(async (ref) => {
            const resolvedId = ref.id ?? (ref.name ? lookupByName.get(ref.name) ?? null : null);
            const detail = resolvedId
              ? await api<any>(`/api/spells/${encodeURIComponent(resolvedId)}`)
              : null;
            if (!detail) return null;
            const text = Array.isArray(detail?.text)
              ? detail.text
                  .map((entry: unknown) => String(entry ?? "").trim())
                  .filter(Boolean)
                  .join("\n")
              : String(detail?.text ?? "").trim();
            return {
              id: String(detail?.id ?? ref.id ?? ref.name ?? ""),
              name: String(detail?.name ?? ref.name ?? ref.id ?? ""),
              text,
            } satisfies InvocationFeatureDetail;
          }),
        );
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
    polymorphRows,
    polymorphRowsBusy,
    polymorphRowsError,
    characterData,
    primaryClassEntry,
  };
}
