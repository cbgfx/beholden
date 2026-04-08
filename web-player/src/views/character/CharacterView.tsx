import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { fetchMyCharacter, updateMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { rollDiceExpr, hasDiceTerm } from "@/lib/dice";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import { useWs } from "@/services/ws";
import {
  Wrap,
  NoteEditDrawer,
} from "@/views/character/CharacterViewParts";
import {
  CharacterActionColumn,
  CharacterInventoryColumn,
  CharacterPrimaryColumn,
  CharacterSupportColumn,
} from "@/views/character/CharacterViewColumns";
import { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import { filterPolymorphRows, useCompendiumMonster } from "@/views/character/CharacterCompendiumMonsterHooks";
import { CharacterInfoDrawer, CharacterPolymorphDrawer } from "@/views/character/CharacterViewDrawers";
import {
  abilityMod,
  formatModifier,
} from "@/views/character/CharacterSheetUtils";
import type {
  CharacterData,
  ConditionInstance,
  PlayerNote,
  ResourceCounter,
} from "@/views/character/CharacterSheetTypes";
import {
  type Character,
  type ClassRestDetail,
  type RaceFeatureDetail,
  type BackgroundFeatureDetail,
  type FeatFeatureDetail,
  type LevelUpFeatDetail,
  type InvocationFeatureDetail,
  type ClassFeatFeatureDetail,
  type SheetOverrides,
  type PolymorphConditionData,
  SHEET_COLOR_PRESETS,
  uid,
  parseLeadingNumberLoose,
  shouldResetOnRest,
  getPolymorphConditionData,
  getPrimaryCharacterClassEntry,
  normalizeCharacterClasses,
  normalizeProficiencies,
} from "@/views/character/CharacterViewHelpers";

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassRestDetail | null>(null);
  const [raceDetail, setRaceDetail] = useState<RaceFeatureDetail | null>(null);
  const [backgroundDetail, setBackgroundDetail] = useState<BackgroundFeatureDetail | null>(null);
  const [bgOriginFeatDetail, setBgOriginFeatDetail] = useState<FeatFeatureDetail | null>(null);
  const [raceFeatDetail, setRaceFeatDetail] = useState<FeatFeatureDetail | null>(null);
  const [classFeatDetails, setClassFeatDetails] = useState<ClassFeatFeatureDetail[]>([]);
  const [levelUpFeatDetails, setLevelUpFeatDetails] = useState<LevelUpFeatDetail[]>([]);
  const [invocationDetails, setInvocationDetails] = useState<InvocationFeatureDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hpAmount, setHpAmount] = useState("");
  const [hpSaving, setHpSaving] = useState(false);
  const [hpError, setHpError] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const hpInputRef = useRef<HTMLInputElement>(null);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [condSaving, setCondSaving] = useState(false);
  const [xpPopupOpen, setXpPopupOpen] = useState(false);
  const [xpInput, setXpInput] = useState("");
  const [dsSaving, setDsSaving] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [expandedClassFeatureIds, setExpandedClassFeatureIds] = useState<string[]>([]);
  const [noteDrawer, setNoteDrawer] = useState<{ scope: "player" | "shared"; note: PlayerNote | null } | null>(null);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [overridesDraft, setOverridesDraft] = useState<SheetOverrides>({ tempHp: 0, acBonus: 0, hpMaxBonus: 0 });
  const [colorDraft, setColorDraft] = useState<string>(C.accentHl);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [concentrationAlert, setConcentrationAlert] = useState<{ dc: number } | null>(null);
  const [polymorphDrawerOpen, setPolymorphDrawerOpen] = useState(false);
  const [polymorphRows, setPolymorphRows] = useState<CompendiumMonsterRow[]>([]);
  const [polymorphRowsBusy, setPolymorphRowsBusy] = useState(false);
  const [polymorphRowsError, setPolymorphRowsError] = useState<string | null>(null);
  const [polymorphQuery, setPolymorphQuery] = useState("");
  const [polymorphTypeFilter, setPolymorphTypeFilter] = useState("beast");
  const [polymorphCrMax, setPolymorphCrMax] = useState("");
  const [polymorphApplyingId, setPolymorphApplyingId] = useState<string | null>(null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const portraitFileRef = useRef<HTMLInputElement>(null);
  const characterData = char?.characterData;
  const primaryClassEntry = getPrimaryCharacterClassEntry(characterData);

  const handlePortraitSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    setPortraitUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await api<{ ok: boolean; imageUrl: string }>(`/api/me/characters/${id}/image`, { method: "POST", body: fd });
      setChar((prev) => prev ? { ...prev, imageUrl: result.imageUrl } : prev);
    } catch (err) { console.error(err); }
    finally { setPortraitUploading(false); }
  }, [id]);

  const fetchChar = useCallback(() => {
    if (!id) return;
    fetchMyCharacter(id)
      .then((next) => setChar(next as Character))
      .catch((e) => setError(e?.message ?? "Failed to load character"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchChar(); }, [fetchChar]);

  useEffect(() => {
    if (char?.id && char.name) {
      try {
        localStorage.setItem("beholden:lastCharacter", JSON.stringify({ id: char.id, name: char.name }));
        window.dispatchEvent(new CustomEvent("beholden:lastCharacter"));
      } catch {}
    }
  }, [char?.id, char?.name]);

  const polymorphTypeOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const row of polymorphRows) {
      const type = String(row.type ?? "").trim().toLowerCase();
      if (type) values.add(type);
    }
    return ["all", ...Array.from(values).sort()];
  }, [polymorphRows]);

  const filteredPolymorphRows = React.useMemo(() => {
    return filterPolymorphRows({
      rows: polymorphRows,
      query: polymorphQuery,
      typeFilter: polymorphTypeFilter,
      crMax: polymorphCrMax,
    });
  }, [polymorphRows, polymorphQuery, polymorphTypeFilter, polymorphCrMax]);

  useEffect(() => {
    const classId = primaryClassEntry?.classId;
    if (!classId) {
      setClassDetail(null);
      return;
    }
    let alive = true;
    api<ClassRestDetail>(`/api/compendium/classes/${classId}`)
      .then((detail) => { if (alive) setClassDetail(detail ?? null); })
      .catch(() => { if (alive) setClassDetail(null); });
    return () => { alive = false; };
  }, [primaryClassEntry?.classId]);

  useEffect(() => {
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
    return () => { alive = false; };
  }, [polymorphDrawerOpen, polymorphRows.length]);

  useEffect(() => {
    const raceId = characterData?.raceId;
    if (!raceId) {
      setRaceDetail(null);
      return;
    }
    let alive = true;
    api<RaceFeatureDetail>(`/api/compendium/races/${raceId}`)
      .then((detail) => { if (alive) setRaceDetail(detail); })
      .catch(() => { if (alive) setRaceDetail(null); });
    return () => { alive = false; };
  }, [characterData?.raceId]);

  useEffect(() => {
    const bgId = characterData?.bgId;
    if (!bgId) {
      setBackgroundDetail(null);
      return;
    }
    let alive = true;
    api<BackgroundFeatureDetail>(`/api/compendium/backgrounds/${bgId}`)
      .then((detail) => { if (alive) setBackgroundDetail(detail); })
      .catch(() => { if (alive) setBackgroundDetail(null); });
    return () => { alive = false; };
  }, [characterData?.bgId]);

  useEffect(() => {
    const featId = characterData?.chosenRaceFeatId;
    if (!featId) {
      setRaceFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => { if (alive) setRaceFeatDetail(detail); })
      .catch(() => { if (alive) setRaceFeatDetail(null); });
    return () => { alive = false; };
  }, [characterData?.chosenRaceFeatId]);

  useEffect(() => {
    const featId = characterData?.chosenBgOriginFeatId;
    if (!featId) {
      setBgOriginFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => { if (alive) setBgOriginFeatDetail(detail); })
      .catch(() => { if (alive) setBgOriginFeatDetail(null); });
    return () => { alive = false; };
  }, [characterData?.chosenBgOriginFeatId]);

  useEffect(() => {
    const entries = Object.entries(characterData?.chosenClassFeatIds ?? {}).filter(([, featId]): featId is string =>
      typeof featId === "string" && featId.trim().length > 0
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
      })
    )
      .then((details) => { if (alive) setClassFeatDetails(details); })
      .catch(() => { if (alive) setClassFeatDetails([]); });
    return () => { alive = false; };
  }, [characterData?.chosenClassFeatIds]);

  useEffect(() => {
    const entries = Array.isArray(characterData?.chosenLevelUpFeats)
      ? characterData.chosenLevelUpFeats.filter((entry): entry is { level: number; featId: string } =>
          typeof entry?.level === "number" && typeof entry?.featId === "string" && entry.featId.trim().length > 0
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
      })
    )
      .then((details) => {
        if (alive) setLevelUpFeatDetails(details);
      })
      .catch(() => {
        if (alive) setLevelUpFeatDetails([]);
      });
    return () => { alive = false; };
  }, [characterData?.chosenLevelUpFeats]);

  useEffect(() => {
    const chosenInvocationIds = Array.isArray(characterData?.chosenInvocations)
      ? characterData.chosenInvocations.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const profInvocationEntries = Array.isArray(characterData?.proficiencies?.invocations)
      ? characterData.proficiencies.invocations.filter((entry): entry is { id?: string; name?: string } => Boolean(entry))
      : [];
    const invocationRefs = [
      ...chosenInvocationIds.map((id) => ({ id, name: null as string | null })),
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
    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    Promise.all(
      invocationRefs.map(async (ref) => {
        const detail = ref.id
          ? await api<any>(`/api/spells/${encodeURIComponent(ref.id)}`)
          : await api<Array<{ id: string; name: string }>>(`/api/spells/search?q=${encodeURIComponent(ref.name ?? "")}&limit=5`)
              .then(async (results) => {
                const exact = results.find((entry) => normalizeName(String(entry.name ?? "")) === normalizeName(ref.name ?? ""));
                const match = exact ?? results[0];
                if (!match?.id) return null;
                return api<any>(`/api/spells/${encodeURIComponent(match.id)}`);
              });
        if (!detail) return null;
        const text = Array.isArray(detail?.text)
          ? detail.text.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean).join("\n")
          : String(detail?.text ?? "").trim();
        return {
          id: String(detail?.id ?? ref.id ?? ref.name ?? ""),
          name: String(detail?.name ?? ref.name ?? ref.id ?? ""),
          text,
        } satisfies InvocationFeatureDetail;
      })
    )
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
    return () => { alive = false; };
  }, [characterData?.chosenInvocations, characterData?.proficiencies?.invocations]);

  // Re-fetch whenever the DM changes something in any campaign this character is in
  useWs(useCallback((msg) => {
    if (msg.type !== "players:changed") return;
    const campaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (!campaignId) return;
    // Only reload if this character is actually assigned to that campaign
    setChar((prev) => {
      if (prev?.campaigns.some((c) => c.campaignId === campaignId)) {
        fetchChar();
      }
      return prev; // state unchanged — fetchChar will update it
    });
  }, [fetchChar]));

  useEffect(() => {
    const source = char?.overrides ?? characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
    setOverridesDraft({
      tempHp: Math.max(0, Math.floor(Number(source.tempHp ?? 0) || 0)),
      acBonus: Math.floor(Number(source.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(source.hpMaxBonus ?? 0) || 0),
    });
  }, [char?.overrides?.tempHp, char?.overrides?.acBonus, char?.overrides?.hpMaxBonus, characterData?.sheetOverrides?.tempHp, characterData?.sheetOverrides?.acBonus, characterData?.sheetOverrides?.hpMaxBonus]);

  useEffect(() => {
    setColorDraft(char?.color ?? C.accentHl);
  }, [char?.color]);

  const polymorphCondition = getPolymorphConditionData(char?.conditions);
  const polymorphMonsterId = polymorphCondition?.polymorphMonsterId ?? null;
  const polymorphMonsterState = useCompendiumMonster(polymorphMonsterId, "Failed to load transformed form.");

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const {
    currentCharacterData,
    prof,
    pb,
    hd,
    hitDieSize,
    hitDiceMax,
    hitDiceCurrent,
    inventory,
    scores,
    scoreExplanations,
    classFeaturesList,
    parsedFeatureEffects,
    grantedSpellData,
    classResourcesWithSpellCasts,
    polymorphName,
    rageActive,
    parsedDefenses,
    usesFlexiblePreparedList,
    preparedSpellLimit,
    preparedSpells,
    invocationSpellDamageBonuses,
    accentColor,
    overrides,
    featureHpMaxBonus,
    effectiveHpMax,
    xpEarned,
    xpNeeded,
    nonProficientArmorPenalty,
    hasDisadvantage,
    stealthDisadvantage,
    conMod,
    hasJackOfAllTrades,
    effectiveAc,
    effectiveSpeed,
    movementModes,
    tempHp,
    hpPct,
    tempPct,
    passivePerc,
    passiveInv,
    initiativeBonus,
    transformedCombatStats,
    saveBonuses,
    abilityCheckAdvantages,
    abilityCheckDisadvantages,
    saveAdvantages,
    saveDisadvantages,
    skillAdvantages,
    skillDisadvantages,
    rageDamageBonus,
    unarmedRageDamageBonus,
    senses,
    editableOverrideFields,
    identityFields,
  } = buildCharacterViewDerivedState({
    char,
    classDetail,
    raceDetail,
    backgroundDetail,
    bgOriginFeatDetail,
    raceFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    invocationDetails,
    subclass: primaryClassEntry?.subclass ?? null,
    polymorphCondition,
    polymorphMonsterState,
  });

  // Sync the computed effective AC to the DM via a dedicated `syncedAc` field so the DM's
  // Players panel shows the correct value (armor + features + shield, without DM acBonus override).
  // We use `syncedAc` — NOT `ac` — so the player's formula (Math.max(char.ac, wornArmorAc) + bonuses)
  // is never affected by the sync, which would otherwise cause an infinite inflate loop.
  const syncedAcValue = effectiveAc - (overrides?.acBonus ?? 0);
  const lastSyncedAcRef = useRef<{ charId: string; ac: number } | null>(null);
  useEffect(() => {
    if (!char) return;
    const prev = lastSyncedAcRef.current;
    if (prev?.charId === char.id && prev?.ac === syncedAcValue) return;
    lastSyncedAcRef.current = { charId: char.id, ac: syncedAcValue };
    if (syncedAcValue !== char.syncedAc) {
      void api(`/api/me/characters/${char.id}`, jsonInit("PUT", { syncedAc: syncedAcValue }));
    }
  }, [syncedAcValue, char?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function rollAndFlash(): number {
    const result = rollDiceExpr(hpAmount.trim());
    if (hasDiceTerm(hpAmount)) {
      setHpAmount(String(result));
      setLastRoll(result);
      if (flashRef.current) window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setLastRoll(null), 1600);
      hpInputRef.current?.focus();
    }
    return result;
  }

  async function commitPolymorphResolution(params: {
    hpCurrent: number;
    overrides: SheetOverrides;
    conditions: ConditionInstance[];
  }) {
    if (!char) return;
    const { hpCurrent, overrides: nextOverrides, conditions: nextConditions } = params;
    await Promise.all([
      api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent })),
      api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides)),
      api(`/api/me/characters/${char.id}/conditions`, jsonInit("PATCH", { conditions: nextConditions })),
    ]);
    setChar((prev) => prev ? {
      ...prev,
      hpCurrent,
      overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
      conditions: nextConditions,
      characterData: {
        ...(prev.characterData ?? {}),
        sheetOverrides: nextOverrides,
      },
    } : prev);
  }

  async function revertPolymorph(applyOverflowDamage = 0) {
    if (!char || !polymorphCondition) return;
    const originalHp = typeof polymorphCondition.originalHpCurrent === "number"
      ? polymorphCondition.originalHpCurrent
      : 0;
    const nextOverrides: SheetOverrides = {
      tempHp: Math.max(0, Number(overrides.tempHp ?? 0) || 0),
      acBonus: Math.floor(Number(polymorphCondition.originalAcBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(polymorphCondition.originalHpMaxBonus ?? 0) || 0),
      inspiration: overrides.inspiration,
    };
    const nextConditions = (char.conditions ?? []).filter((condition) => condition.key !== "polymorphed");
    await commitPolymorphResolution({
      hpCurrent: Math.max(0, originalHp - Math.max(0, applyOverflowDamage)),
      overrides: nextOverrides,
      conditions: nextConditions,
    });
  }

  async function applyPolymorphSelf(row: CompendiumMonsterRow) {
    if (!char) return;
    setPolymorphApplyingId(row.id);
    try {
      const detail = await api<any>(`/api/compendium/monsters/${encodeURIComponent(row.id)}`);
      const ac = parseLeadingNumberLoose(detail?.ac);
      const hp = parseLeadingNumberLoose(detail?.hp);
      if (!Number.isFinite(ac) || !Number.isFinite(hp) || ac <= 0 || hp <= 0) {
        throw new Error("Selected form is missing usable AC or HP.");
      }
      const nextOverrides: SheetOverrides = {
        tempHp: Math.max(0, Number(overrides.tempHp ?? 0) || 0),
        acBonus: Math.round(ac) - char.ac,
        hpMaxBonus: Math.round(hp) - char.hpMax,
        inspiration: overrides.inspiration,
      };
      const nextConditions: ConditionInstance[] = [
        ...(char.conditions ?? []).filter((condition) => condition.key !== "polymorphed"),
        {
          key: "polymorphed",
          polymorphName: row.name,
          polymorphMonsterId: row.id,
          originalAcBonus: Math.floor(Number(overrides.acBonus ?? 0) || 0),
          originalHpMaxBonus: Math.floor(Number(overrides.hpMaxBonus ?? 0) || 0),
          originalHpCurrent: char.hpCurrent,
        },
      ];
      await commitPolymorphResolution({
        hpCurrent: Math.round(hp),
        overrides: nextOverrides,
        conditions: nextConditions,
      });
      setPolymorphDrawerOpen(false);
    } finally {
      setPolymorphApplyingId(null);
    }
  }

  async function applyHp(kind: "damage" | "heal", resolvedAmt?: number) {
    const amt = resolvedAmt ?? rollDiceExpr(hpAmount.trim());
    if (amt <= 0) {
      setHpError("Enter a number > 0  (e.g. 8, 2d6+3, +5)");
      return;
    }
    if (!char) return;
    setHpError(null);
    setHpSaving(true);
    try {
      if (kind === "heal") {
        const newHp = Math.min(char.hpCurrent + amt, effectiveHpMax);
        await api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent: newHp }));
        setChar((prev) => prev ? { ...prev, hpCurrent: newHp } : prev);
      } else {
        const currentTemp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
        const fromTemp = Math.min(currentTemp, amt);
        const nextTemp = currentTemp - fromTemp;
        const remaining = Math.max(0, amt - fromTemp);
        if (polymorphCondition && remaining >= char.hpCurrent) {
          await revertPolymorph(remaining - char.hpCurrent);
        } else {
          const newHp = Math.max(0, char.hpCurrent - remaining);
          const nextOverrides = nextTemp === currentTemp
            ? null
            : { ...overrides, tempHp: nextTemp };
          await api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent: newHp }));
          if (nextOverrides) {
            await api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides));
          }
          setChar((prev) => prev ? {
            ...prev,
            hpCurrent: newHp,
            overrides: nextOverrides ? { ...(prev.overrides ?? {}), ...nextOverrides } : prev.overrides,
            characterData: nextOverrides ? {
              ...(prev.characterData ?? {}),
              sheetOverrides: nextOverrides,
            } : prev.characterData,
          } : prev);
        }
      }
      setHpAmount("");
      setLastRoll(null);
      if (kind === "damage" && amt > 0 && (char.conditions ?? []).some((c) => c.key === "concentration")) {
        setConcentrationAlert({ dc: Math.max(10, Math.floor(amt / 2)) });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setHpError(`Failed: ${msg}`);
      console.error("HP update failed:", e);
    } finally {
      setHpSaving(false);
    }
  }

  /** If the expression starts with '+', auto-treat as heal. */
  function resolveKind(explicit: "damage" | "heal"): "damage" | "heal" {
    if (hpAmount.trim().startsWith("+")) return "heal";
    return explicit;
  }

  async function saveXp(value: number) {
    if (!char) return;
    const updated: CharacterData = { ...currentCharacterData, xp: value };
    await saveCharacterData(updated);
    setXpPopupOpen(false);
  }

  async function saveHitDiceCurrent(nextValue: number) {
    const next = Math.max(0, Math.min(hitDiceMax, Math.floor(nextValue)));
    await saveCharacterData({ ...currentCharacterData, hitDiceCurrent: next });
  }

  async function saveResources(nextResources: ResourceCounter[]) {
    await saveCharacterData({ ...currentCharacterData, resources: nextResources });
  }

  async function saveUsedSpellSlots(next: Record<string, number>) {
    await saveCharacterData({ ...currentCharacterData, usedSpellSlots: next });
  }

  async function savePreparedSpells(next: string[]) {
    const unique = Array.from(new Set(next));
    const forced = unique.filter((entry) => forcedPreparedSpellKeys.has(entry));
    const userChosen = unique.filter((entry) => !forcedPreparedSpellKeys.has(entry));
    const limitedUserChosen = preparedSpellLimit > 0 ? userChosen.slice(0, preparedSpellLimit) : userChosen;
    const limited = [...forced, ...limitedUserChosen];
    await saveCharacterData({ ...currentCharacterData, preparedSpells: limited });
  }

  const _baseProficiencies = currentCharacterData.proficiencies ?? {
    skills: [], expertise: [], saves: [], armor: [], weapons: [], tools: [], languages: [], spells: [], invocations: [], maneuvers: [], plans: [],
  };

  const _normalizeSpellName = (n: string) => n.replace(/\s*\[[^\]]+\]\s*$/u, "").trim().toLowerCase();

  async function addTrackedSpell(spell: { name: string; id?: string; level?: number | null }) {
    const spellName = String(spell.name ?? "").trim();
    if (!spellName) return;
    const normalized = _normalizeSpellName(spellName);
    const existing = Array.isArray(currentCharacterData.proficiencies?.spells) ? currentCharacterData.proficiencies.spells : [];
    if (existing.some((entry) => _normalizeSpellName(entry.name) === normalized)) return;
    const nextSpells = [
      ...existing,
      { name: spellName, source: classDetail?.name ?? char.className ?? "Manual", ...(spell.id ? { id: String(spell.id) } : {}) },
    ].sort((a, b) => a.name.localeCompare(b.name));
    const nextPreparedSpells = (() => {
      if (!usesFlexiblePreparedList || !spell.level || spell.level <= 0) return currentCharacterData.preparedSpells;
      const currentPrepared = Array.isArray(currentCharacterData.preparedSpells) ? currentCharacterData.preparedSpells : [];
      const normalizedKey = normalizeSpellTrackingKey(spellName);
      if (!normalizedKey || currentPrepared.includes(normalizedKey) || forcedPreparedSpellKeys.has(normalizedKey)) return currentPrepared;
      const userPreparedCount = currentPrepared.filter((entry) => !forcedPreparedSpellKeys.has(entry)).length;
      if (preparedSpellLimit > 0 && userPreparedCount >= preparedSpellLimit) return currentPrepared;
      return [...currentPrepared, normalizedKey];
    })();
    await saveCharacterData({
      ...currentCharacterData,
      preparedSpells: nextPreparedSpells,
      proficiencies: { ..._baseProficiencies, spells: nextSpells },
    });
  }

  async function removeTrackedSpell(spellName: string) {
    const normalized = _normalizeSpellName(spellName);
    const existing = Array.isArray(currentCharacterData.proficiencies?.spells) ? currentCharacterData.proficiencies.spells : [];
    const nextSpells = existing.filter((entry) => _normalizeSpellName(entry.name) !== normalized);
    const nextPrepared = preparedSpells.filter((key) => key !== normalized.replace(/[^a-z0-9]/g, ""));
    await saveCharacterData({
      ...currentCharacterData,
      preparedSpells: nextPrepared,
      proficiencies: { ..._baseProficiencies, spells: nextSpells },
    });
  }

  async function handleItemChargeChange(itemId: string, charges: number) {
    const nextInventory = inventory.map((it) => it.id === itemId ? { ...it, charges } : it);
    await saveCharacterData({ ...currentCharacterData, inventory: nextInventory });
  }

  async function changeResourceCurrent(key: string, delta: number) {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      resource.key !== key
        ? resource
        : { ...resource, current: Math.max(0, Math.min(resource.max, resource.current + delta)) }
    );
    await saveResources(nextResources);
  }

  async function handleShortRest() {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "short")
        ? {
            ...resource,
            current: resource.restoreAmount === "one"
              ? Math.min(resource.max, resource.current + 1)
              : resource.max,
          }
        : resource
    );
    // Warlocks reset spell slots on short rest
    const slotsReset = classDetail?.slotsReset ?? "L";
    if (/S/i.test(slotsReset)) {
      await saveCharacterData({ ...currentCharacterData, resources: nextResources, usedSpellSlots: {} });
    } else {
      await saveResources(nextResources);
    }
  }

  async function handleLongRest() {
    if (!char) return;
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "long")
        ? { ...resource, current: resource.max }
        : resource
    );
    const recoveredHitDice = hitDiceMax > 0 ? Math.max(1, Math.floor(hitDiceMax / 2)) : 0;
    const nextHitDice = Math.max(0, Math.min(hitDiceMax, hitDiceCurrent + recoveredHitDice));
    // Reset spell slots on long rest (unless Warlock which uses short rest — checked via slotsReset)
    const slotsReset = classDetail?.slotsReset ?? "L";
    const nextUsedSpellSlots = /S/i.test(slotsReset) ? (currentCharacterData.usedSpellSlots ?? {}) : {};
    // Reset item charges on long rest
    const nextInventory = inventory.map((it) =>
      (it.chargesMax ?? 0) > 0 ? { ...it, charges: it.chargesMax } : it
    );

    await api(`/api/me/characters/${char.id}`, jsonInit("PUT", {
      hpCurrent: effectiveHpMax,
      characterData: {
        ...currentCharacterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    }));

    const nextDeathSaves = { success: 0, fail: 0 };
    await api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", nextDeathSaves));

    const hasResourceful = raceDetail?.traits?.some((t) => /^resourceful$/i.test(t.name)) ?? false;
    if (hasResourceful && !(overrides.inspiration ?? false)) {
      await api(`/api/me/characters/${char.id}/inspiration`, jsonInit("PATCH", { inspiration: true }));
    }

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMax,
      deathSaves: nextDeathSaves,
      overrides: hasResourceful ? { ...prev.overrides!, inspiration: true } : prev.overrides,
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    } : prev);
  }

  async function handleFullRest() {
    if (!char) return;
    const nextResources = classResourcesWithSpellCasts.map((resource) => ({
      ...resource,
      current: resource.max,
    }));
    const nextHitDice = hitDiceMax;
    const nextUsedSpellSlots: Record<string, number> = {};
    const nextInventory = inventory.map((it) =>
      (it.chargesMax ?? 0) > 0 ? { ...it, charges: it.chargesMax } : it
    );
    const nextDeathSaves = { success: 0, fail: 0 };
    const nextOverrides = {
      tempHp: 0,
      acBonus: Math.floor(Number(overrides.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(overrides.hpMaxBonus ?? 0) || 0),
      inspiration: overrides.inspiration,
    };
    const hasResourceful = raceDetail?.traits?.some((t) => /^resourceful$/i.test(t.name)) ?? false;
    const nextInspiration = hasResourceful ? true : (overrides.inspiration ?? false);

    await api(`/api/me/characters/${char.id}`, jsonInit("PUT", {
      hpCurrent: effectiveHpMax,
      characterData: {
        ...currentCharacterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    }));
    await Promise.all([
      api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", nextDeathSaves)),
      api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides)),
      hasResourceful && !(overrides.inspiration ?? false)
        ? api(`/api/me/characters/${char.id}/inspiration`, jsonInit("PATCH", { inspiration: true }))
        : Promise.resolve(null),
    ]);

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMax,
      deathSaves: nextDeathSaves,
      overrides: { ...(prev.overrides ?? {}), ...nextOverrides, inspiration: nextInspiration },
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
        sheetOverrides: nextOverrides,
      },
    } : prev);
  }

  async function handleToggleInspiration() {
    if (!char) return;
    const next = !(overrides.inspiration ?? false);
    await api(`/api/me/characters/${char.id}/inspiration`, jsonInit("PATCH", { inspiration: next }));
    setChar((prev) => prev ? { ...prev, overrides: { ...prev.overrides!, inspiration: next } } : prev);
  }

  function handleApplyHp(explicit: "damage" | "heal") {
    const kind = resolveKind(explicit);
    if (hasDiceTerm(hpAmount)) {
      const rolled = rollAndFlash();
      // apply on next tick so the rolled value flashes first
      setTimeout(() => applyHp(kind, rolled), 0);
    } else {
      applyHp(kind);
    }
  }

  async function saveDeathSaves(next: { success: number; fail: number }) {
    if (!char) return;
    setDsSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", next));
      setChar((prev) => prev ? { ...prev, deathSaves: next } : prev);
    } catch (e) {
      console.error("Death saves update failed:", e);
    } finally {
      setDsSaving(false);
    }
  }

  async function toggleCondition(key: string) {
    if (!char) return;
    if (key === "polymorphed") {
      setCondSaving(true);
      try {
        await revertPolymorph(0);
      } catch (error) {
        fetchChar();
        console.error("Polymorph revert failed:", error);
      } finally {
        setCondSaving(false);
      }
      return;
    }
    const current = char.conditions ?? [];
    const has = current.some((c) => c.key === key);
    const next = has ? current.filter((c) => c.key !== key) : [...current, { key }];
    setCondSaving(true);
    try {
      let nextCharacterData = currentCharacterData;
      if (key === "rage" && !has) {
        if (!/barbarian/i.test(String(char.className ?? ""))) return;
        const rageResource = classResourcesWithSpellCasts.find((resource) => /^rage$/i.test(resource.name) || resource.key === "rage");
        if (!rageResource || rageResource.current <= 0) return;
        const nextResources = classResourcesWithSpellCasts.map((resource) =>
          resource.key !== rageResource.key ? resource : { ...resource, current: Math.max(0, resource.current - 1) }
        );
        nextCharacterData = { ...currentCharacterData, resources: nextResources };
        await saveCharacterData(nextCharacterData);
      }
      await api(`/api/me/characters/${char.id}/conditions`, jsonInit("PATCH", { conditions: next }));
      setChar((prev) => prev ? { ...prev, conditions: next, characterData: { ...(prev.characterData ?? {}), ...nextCharacterData } } : prev);
    } catch (error) {
      fetchChar();
      console.error("Condition update failed:", error);
    } finally { setCondSaving(false); }
  }

  async function saveCharacterData(updatedData: CharacterData) {
    const mergedData = { ...(characterData ?? {}), ...updatedData };
    const normalizedDataBase = mergedData.proficiencies
      ? { ...mergedData, proficiencies: normalizeProficiencies(mergedData.proficiencies) }
      : mergedData;
    const normalizedClasses = normalizeCharacterClasses(normalizedDataBase);
    const normalizedData = {
      ...normalizedDataBase,
      classes: normalizedClasses,
    };
    const updated = await updateMyCharacter(char!.id, {
      name: char!.name,
      characterData: normalizedData,
    });
    setChar((prev) => prev ? { ...prev, characterData: { ...(prev.characterData ?? {}), ...normalizedData } } : prev);
    return updated as Character;
  }

  async function saveSheetOverrides() {
    if (!char) return;
    const nextOverrides = {
      tempHp: Math.max(0, Math.floor(Number(overridesDraft.tempHp) || 0)),
      acBonus: Math.floor(Number(overridesDraft.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(overridesDraft.hpMaxBonus) || 0),
    };
    const nextColor = colorDraft || C.accentHl;
    setOverridesSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides));
      if ((char.color ?? C.accentHl) !== nextColor) {
        await updateMyCharacter(char.id, {
          name: char.name,
          color: nextColor,
        });
      }
      setChar((prev) => prev ? {
        ...prev,
        color: nextColor,
        overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
        characterData: {
          ...(prev.characterData ?? {}),
          sheetOverrides: nextOverrides,
        },
      } : prev);
      setInfoDrawerOpen(false);
    } finally {
      setOverridesSaving(false);
    }
  }

  const playerNotesList: PlayerNote[] = currentCharacterData.playerNotesList ?? [];
  // Player-owned shared notes (editable)
  const sharedNotesList: PlayerNote[] = (() => {
    if (!char.sharedNotes) return [];
    try { return JSON.parse(char.sharedNotes) as PlayerNote[]; } catch { return []; }
  })();
  // Campaign-level notes from DM — merged into the editable list, player version wins on ID clash
  const campaignNotesList: PlayerNote[] = (() => {
    if (!char.campaignSharedNotes) return [];
    try { return JSON.parse(char.campaignSharedNotes) as PlayerNote[]; } catch { return []; }
  })();
  const playerNoteIds = new Set(sharedNotesList.map((n) => n.id));
  const allSharedNotes: PlayerNote[] = [
    ...campaignNotesList.filter((n) => !playerNoteIds.has(n.id)),
    ...sharedNotesList,
  ];

  async function savePlayerNotesList(list: PlayerNote[]) {
    await saveCharacterData({ playerNotesList: list });
  }

  async function saveCustomResistances(values: string[]) {
    await saveCharacterData({ customResistances: values });
  }

  async function saveCustomImmunities(values: string[]) {
    await saveCharacterData({ customImmunities: values });
  }

  function saveSharedNotesList(list: PlayerNote[]) {
    // list is allSharedNotes (campaign notes + player notes). Strip out any note whose ID
    // came from the server-supplied campaignSharedNotes so we only persist player-authored
    // notes. Campaign/party notes must remain read-only from the player's perspective.
    const campaignNoteIds = new Set(campaignNotesList.map((n) => n.id));
    const playerOnlyNotes = list.filter((n) => !campaignNoteIds.has(n.id));
    const val = JSON.stringify(playerOnlyNotes);
    void api(`/api/me/characters/${char!.id}/sharedNotes`, jsonInit("PATCH", { sharedNotes: val }));
    setChar((prev) => prev ? { ...prev, sharedNotes: val } : prev);
  }

  function handleNoteSave(title: string, text: string) {
    if (!noteDrawer) return;
    const { scope, note } = noteDrawer;
    const list = scope === "player" ? playerNotesList : allSharedNotes;
    const updated = note
      ? list.map((n) => n.id === note.id ? { ...n, title, text } : n)
      : [...list, { id: uid(), title, text }];
    if (scope === "player") void savePlayerNotesList(updated);
    else saveSharedNotesList(updated);
    setNoteDrawer(null);
  }

  function handleNoteDelete(scope: "player" | "shared", id: string) {
    const list = scope === "player" ? playerNotesList : allSharedNotes;
    const updated = list.filter((n) => n.id !== id);
    if (scope === "player") void savePlayerNotesList(updated);
    else saveSharedNotesList(updated);
    setExpandedNoteIds((prev) => prev.filter((eid) => eid !== id));
  }

  const _makeToggleExpanded = (setFn: React.Dispatch<React.SetStateAction<string[]>>) =>
    (id: string) => setFn((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  const toggleNoteExpanded = _makeToggleExpanded(setExpandedNoteIds);
  const toggleClassFeatureExpanded = _makeToggleExpanded(setExpandedClassFeatureIds);

  return (
    <Wrap wide>
      <input
        ref={portraitFileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePortraitSelected}
      />
      {concentrationAlert && (
        <div style={{
          marginBottom: 10, padding: "10px 14px", borderRadius: 10,
          background: "rgba(240, 165, 0, 0.15)", border: `1px solid ${C.accent}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ color: C.text, fontWeight: 700 }}>
            ⚠️ You are Concentrating — CON Save DC <strong>{concentrationAlert.dc}</strong>
          </span>
          <button
            onClick={() => setConcentrationAlert(null)}
            style={{ all: "unset", cursor: "pointer", color: C.muted, fontWeight: 900, fontSize: "var(--fs-title)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
      {/* ── 4-column layout ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(420px, 1fr))", gap: 16, alignItems: "flex-start" }}>
        <CharacterPrimaryColumn
          hudProps={{
            char,
            accentColor,
            xpEarned,
            xpNeeded,
            xpInput,
            xpPopupOpen,
            setXpInput,
            setXpPopupOpen,
            saveXp,
            onOpenInfo: () => setInfoDrawerOpen(true),
            onLevelUp: () => navigate(`/characters/${char.id}/levelup`),
            onEdit: () => navigate(`/characters/${char.id}/edit`),
            onPortraitClick: () => portraitFileRef.current?.click(),
            portraitUploading,
            effectiveHpMax,
            tempHp,
            hpPct,
            tempPct,
            hpError,
            hpSaving,
            hpAmount,
            hd,
            lastRoll,
            hpInputRef,
            setHpError,
            setLastRoll,
            setHpAmount,
            handleApplyHp,
            inspirationActive: overrides.inspiration ?? false,
            handleToggleInspiration,
            condPickerOpen,
            setCondPickerOpen,
            condSaving,
            toggleCondition,
            dsSaving,
            saveDeathSaves,
            hpMaxBonus: overrides.hpMaxBonus ?? 0,
          }}
          abilitiesProps={{
            scores,
            scoreExplanations,
            pb,
            prof,
            saveBonuses,
            abilityCheckAdvantages,
            abilityCheckDisadvantages,
            saveAdvantages,
            saveDisadvantages,
            skillAdvantages,
            skillDisadvantages,
            accentColor,
            stealthDisadvantage,
            nonProficientArmorPenalty,
            hasJackOfAllTrades,
            mod: abilityMod,
            fmtMod: formatModifier,
          }}
          defensesProps={{
            resistances: parsedDefenses.resistances,
            damageImmunities: parsedDefenses.damageImmunities,
            conditionImmunities: parsedDefenses.conditionImmunities,
            senses,
            customResistances: currentCharacterData.customResistances ?? [],
            customImmunities: currentCharacterData.customImmunities ?? [],
            accentColor,
            onCustomResistancesChange: (value) => { void saveCustomResistances(value); },
            onCustomImmunitiesChange: (value) => { void saveCustomImmunities(value); },
          }}
          proficienciesProps={{ prof, accentColor }}
        />

        <CharacterActionColumn
          combatProps={{
            effectiveAc: transformedCombatStats?.effectiveAc ?? effectiveAc,
            speed: transformedCombatStats?.speed ?? effectiveSpeed,
            movementModes: transformedCombatStats?.movementModes ?? movementModes,
            level: char.level,
            className: transformedCombatStats?.className ?? char.className,
            initiativeBonus: transformedCombatStats?.initiativeBonus ?? initiativeBonus,
            strScore: transformedCombatStats?.strScore ?? scores.str,
            dexScore: transformedCombatStats?.dexScore ?? scores.dex,
            pb: transformedCombatStats?.pb ?? pb,
            passivePerc: transformedCombatStats?.passivePerc ?? passivePerc,
            passiveInv: transformedCombatStats?.passiveInv ?? passiveInv,
            accentColor,
            inventory,
            prof,
            parsedFeatureEffects,
            nonProficientArmorPenalty,
            hasDisadvantage,
            rageDamageBonus,
            unarmedRageDamageBonus,
            rageActive,
            showActions: !polymorphCondition,
          }}
          polymorphed={Boolean(polymorphCondition)}
          polymorphMonsterState={polymorphMonsterState}
          itemSpellsProps={{
            items: inventory,
            pb,
            intScore: scores.int,
            wisScore: scores.wis,
            chaScore: scores.cha,
            accentColor,
            onChargeChange: handleItemChargeChange,
            spellcastingBlocked: nonProficientArmorPenalty,
          }}
          richSpellsProps={{
            spells: prof?.spells ?? [],
            grantedSpells: grantedSpellData.spells,
            resources: classResourcesWithSpellCasts,
            pb,
            scores,
            accentColor,
            classDetail,
            charLevel: char.level,
            preparedLimit: preparedSpellLimit,
            usesFlexiblePreparedList,
            usedSpellSlots: currentCharacterData.usedSpellSlots ?? {},
            preparedSpells,
            onSlotsChange: saveUsedSpellSlots,
            onPreparedChange: savePreparedSpells,
            onAddSpell: addTrackedSpell,
            onRemoveSpell: removeTrackedSpell,
            addSpellSourceLabel: classDetail?.name ?? char.className ?? "Manual",
            onResourceChange: changeResourceCurrent,
            spellcastingBlocked: nonProficientArmorPenalty,
            spellDamageBonuses: invocationSpellDamageBonuses,
          }}
        />

        <CharacterInventoryColumn
          inventoryProps={{
            char,
            charData: char.characterData,
            parsedFeatureEffects,
            accentColor,
            campaignId: char.campaigns[0]?.campaignId ?? null,
            onSave: saveCharacterData,
          }}
          creaturesProps={{
            charData: char.characterData,
            accentColor,
            onSave: saveCharacterData,
          }}
        />

        <CharacterSupportColumn
          accentColor={accentColor}
          hasCampaign={char.campaigns.length > 0}
          hitDiceCurrent={hitDiceCurrent}
          hitDiceMax={hitDiceMax}
          hitDieSize={hitDieSize}
          hitDieConMod={conMod}
          featureHpMaxBonus={featureHpMaxBonus}
          classResources={classResourcesWithSpellCasts}
          playerNotesList={playerNotesList}
          allSharedNotes={allSharedNotes}
          classFeaturesList={classFeaturesList}
          expandedNoteIds={expandedNoteIds}
          expandedClassFeatureIds={expandedClassFeatureIds}
          onSaveHitDiceCurrent={(value) => saveHitDiceCurrent(value)}
          onShortRest={() => handleShortRest()}
          onLongRest={() => handleLongRest()}
          onFullRest={() => handleFullRest()}
          onChangeResourceCurrent={(key, delta) => changeResourceCurrent(key, delta)}
          onOpenPlayerNoteCreate={() => setNoteDrawer({ scope: "player", note: null })}
          onOpenSharedNoteCreate={() => setNoteDrawer({ scope: "shared", note: null })}
          onToggleNoteExpanded={toggleNoteExpanded}
          onToggleClassFeatureExpanded={toggleClassFeatureExpanded}
          onOpenPlayerNoteEdit={(note) => setNoteDrawer({ scope: "player", note })}
          onOpenSharedNoteEdit={(note) => setNoteDrawer({ scope: "shared", note })}
          onDeletePlayerNote={(id) => handleNoteDelete("player", id)}
          onDeleteSharedNote={(id) => handleNoteDelete("shared", id)}
          onSavePlayerNotesOrder={(list) => { void savePlayerNotesList(list); }}
          onSaveSharedNotesOrder={saveSharedNotesList}
          polymorphName={polymorphName || null}
          onOpenTransformSelf={() => setPolymorphDrawerOpen(true)}
          onRevertTransformSelf={polymorphCondition ? () => { void toggleCondition("polymorphed"); } : undefined}
        />
      </div>
      {/* end 4-column grid */}

      <CharacterPolymorphDrawer
        open={polymorphDrawerOpen}
        accentColor={accentColor}
        polymorphQuery={polymorphQuery}
        polymorphTypeFilter={polymorphTypeFilter}
        polymorphCrMax={polymorphCrMax}
        polymorphTypeOptions={polymorphTypeOptions}
        polymorphRowsBusy={polymorphRowsBusy}
        polymorphRowsError={polymorphRowsError}
        filteredPolymorphRows={filteredPolymorphRows}
        polymorphApplyingId={polymorphApplyingId}
        onClose={() => setPolymorphDrawerOpen(false)}
        onQueryChange={setPolymorphQuery}
        onTypeFilterChange={setPolymorphTypeFilter}
        onCrMaxChange={setPolymorphCrMax}
        onApply={(row) => applyPolymorphSelf(row)}
      />

      {/* Note edit drawer */}
      {noteDrawer && (
        <NoteEditDrawer
          scope={noteDrawer.scope}
          note={noteDrawer.note}
          accentColor={accentColor}
          onSave={handleNoteSave}
          onDelete={noteDrawer.note ? () => { handleNoteDelete(noteDrawer.scope, noteDrawer.note!.id); setNoteDrawer(null); } : undefined}
          onClose={() => setNoteDrawer(null)}
        />
      )}
      <CharacterInfoDrawer
        open={infoDrawerOpen}
        accentColor={accentColor}
        identityFields={identityFields}
        editableOverrideFields={editableOverrideFields}
        overridesDraft={overridesDraft}
        colorDraft={colorDraft}
        colorPresets={SHEET_COLOR_PRESETS}
        overridesSaving={overridesSaving}
        onClose={() => setInfoDrawerOpen(false)}
        onSave={() => saveSheetOverrides()}
        onColorChange={setColorDraft}
        onOverrideChange={(key, value) => {
          setOverridesDraft((prev) => ({
            ...prev,
            [key]: value,
          }));
        }}
      />
    </Wrap>
  );
}

