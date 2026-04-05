import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { fetchMyCharacter, updateMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { rollDiceExpr, hasDiceTerm } from "@/lib/dice";
import { formatCr, parseCrNumber } from "@/lib/monsterPicker/utils";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import {
  formatMonsterTypeLabel,
  getPolymorphCondition,
  parseMonsterSpeed,
  proficiencyBonusFromChallengeRating,
  readMonsterNumber,
  readMonsterSkillBonus,
  type SharedPolymorphCondition,
} from "@beholden/shared/domain";
import { useWs } from "@/services/ws";
import {
  Wrap,
  NoteEditDrawer,
  Panel,
  PanelTitle,
} from "@/views/character/CharacterViewParts";
import { CharacterAbilitiesPanels, CharacterProficienciesPanel } from "@/views/character/CharacterAbilitiesPanels";
import { CharacterCombatPanels } from "@/views/character/CharacterCombatPanels";
import { CharacterHudPanel } from "@/views/character/CharacterHudPanel";
import { InventoryPanel } from "@/views/character/CharacterInventoryPanel";
import {
  buildGrantedSpellDataFromEffects,
  collectSensesFromEffects,
  collectDefensesFromEffects,
  collectMovementModesFromEffects,
  deriveAttackDamageBonusFromEffects,
  deriveArmorClassBonusFromEffects,
  deriveHitPointMaxBonusFromEffects,
  deriveModifierBonusFromEffects,
  deriveModifierStateFromEffects,
  deriveSpeedBonusFromEffects,
  deriveUnarmoredDefenseFromEffects,
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import {
  buildAppliedCharacterFeatures,
  buildPreparedSpellProgressionGrants,
  buildDisplayPlayerFeatures,
} from "@/domain/character/characterFeatures";
import { CharacterDefensesPanel } from "@/views/character/CharacterDefensesPanel";
import { RichSpellsPanel } from "@/views/character/CharacterSpellsPanel";
import { ItemSpellsPanel } from "@/views/character/CharacterItemSpellsPanel";
import { SpellSlotsPanel } from "@/views/character/SpellSlotsPanel";
import { CharacterSupportPanels } from "@/views/character/CharacterSupportPanels";
import {
  abilityMod,
  dedupeTaggedItems,
  formatModifier,
  getInitiativeBonus,
  getPassiveScore,
  getSaveBonus,
  getSkillBonus,
  isLikelyTrackedSpellName,
  normalizeArmorProficiencyName,
  normalizeLanguageName,
  normalizeResourceKey,
  normalizeSpellTrackingKey,
  normalizeSpellTrackingName,
  splitArmorProficiencyNames,
  normalizeWeaponProficiencyName,
  proficiencyBonus,
} from "@/views/character/CharacterSheetUtils";
import { MonsterStatblock } from "@/views/CompendiumView/panels/MonsterStatblock";
import { ABILITY_FULL, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import { getPreparedSpellCount, usesFlexiblePreparedSpells } from "@/views/character-creator/utils/CharacterCreatorUtils";
import type {
  AbilKey,
  CharacterCampaign,
  CharacterData,
  ConditionInstance,
  PlayerNote,
  ProficiencyMap,
  ResourceCounter,
} from "@/views/character/CharacterSheetTypes";
import {
  type InventoryItem,
  getEquipState,
  hasArmorProficiency,
  hasStealthDisadvantage,
  isArmorItem,
  isShieldItem,
} from "@/views/character/CharacterInventory";

/** Total XP required to reach each level (index = level). Index 0 unused. */
const XP_TO_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 260000, 300000, 355000];

interface Character {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
  conditions?: ConditionInstance[];
  overrides?: { tempHp: number; acBonus: number; hpMaxBonus: number; inspiration?: boolean };
  deathSaves?: { success: number; fail: number };
  sharedNotes?: string;
  campaignSharedNotes?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
  subclass?: string | null;
}

interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
    features?: Array<{
      name: string;
      text: string;
      optional?: boolean;
      preparedSpellProgression?: PreparedSpellProgressionTable[];
    }>;
  }>;
}

interface LoreTraitDetail {
  name: string;
  text: string;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

interface RaceFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

interface BackgroundFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

interface FeatFeatureDetail {
  id: string;
  name: string;
  text?: string | null;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

interface LevelUpFeatDetail {
  level: number;
  featId: string;
  feat: FeatFeatureDetail;
}

interface InvocationFeatureDetail {
  id: string;
  name: string;
  text: string;
}

interface ClassFeatFeatureDetail {
  featureName: string;
  feat: FeatFeatureDetail;
}

interface SheetOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
}

type PolymorphConditionData = SharedPolymorphCondition & ConditionInstance;

type EditableSheetOverrideKey = "tempHp" | "acBonus" | "hpMaxBonus";

interface EditableSheetOverrideField {
  key: EditableSheetOverrideKey;
  label: string;
  help: string;
}

interface ResourceProgressionOverride {
  className: string;
  featureName: string;
  values: Array<{ level: number; value: number }>;
}

const RESOURCE_PROGRESSION_OVERRIDES: ResourceProgressionOverride[] = [
  {
    className: "Druid",
    featureName: "Wild Shape",
    values: [
      { level: 2, value: 2 },
      { level: 6, value: 3 },
      { level: 17, value: 4 },
    ],
  },
];

const SHEET_COLOR_PRESETS = [
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#ff5d5d",
  "#8b5cf6",
  "#fb7185",
  "#f97316",
  "#d946ef",
  "#14b8a6",
  "#06b6d4",
  "#84cc16",
  "#eab308",
  "#6366f1",
  "#94a3b8",
  "#ff6b3d",
  "#d08ce9",
  "#b9c4cf",
  "#8a9b32",
  "#a96c4f",
  "#5bc0eb",
  "#d4b24c",
  "#68b38c",
  "#6f6f6a",
  "#cf4444",
  "#8f46d9",
  "#0b5fff",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeCompendiumClassLookupName(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveResourceProgressionOverride(
  className: string | null | undefined,
  featureName: string | null | undefined,
  level: number,
): number | null {
  const normalizedClass = normalizeCompendiumClassLookupName(className);
  const normalizedFeature = String(featureName ?? "").trim().toLowerCase();
  const override = RESOURCE_PROGRESSION_OVERRIDES.find((entry) =>
    normalizeCompendiumClassLookupName(entry.className) === normalizedClass
    && entry.featureName.trim().toLowerCase() === normalizedFeature
  );
  if (!override) return null;
  let result: number | null = null;
  for (const row of override.values) {
    if (row.level <= level) result = row.value;
  }
  return result;
}

function normalizeSubclassLookupName(name: string | null | undefined): string {
  return String(name ?? "").trim().toLowerCase();
}

function stripEditionTag(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s*\[(?:5\.5e|2024|5e|5\.0)\]\s*$/i, "")
    .trim();
}

function parseLeadingNumberLoose(value: unknown): number {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function shouldDisplayClassCounterResource(name: string | null | undefined): boolean {
  const normalized = String(name ?? "").trim();
  if (!normalized) return false;
  if (/^(spells prepared|plans known|known forms)$/i.test(normalized)) return false;
  return true;
}

function collectClassResources(classDetail: ClassRestDetail | null, level: number, selectedSubclass?: string | null): ResourceCounter[] {
  if (!classDetail) return [];
  const latest = new Map<string, ResourceCounter>();
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level > level) continue;
    for (const counter of autolevel.counters ?? []) {
      const max = Math.max(0, Math.floor(Number(counter.value) || 0));
      const name = String(counter.name ?? "").trim();
      const counterSubclass = String(counter.subclass ?? "").trim();
      if (counterSubclass && normalizeSubclassLookupName(counterSubclass) !== normalizeSubclassLookupName(selectedSubclass)) continue;
      if (!name || max <= 0 || !shouldDisplayClassCounterResource(name)) continue;
      const key = normalizeResourceKey(name);
      latest.set(key, {
        key,
        name,
        current: max,
        max,
        reset: String(counter.reset ?? "L").trim().toUpperCase() || "L",
        restoreAmount: "all",
      });
    }
  }
  return Array.from(latest.values());
}

function parseWordCount(value: string): number | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  const direct = Number.parseInt(normalized, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
    once: 1,
    one: 1,
    twice: 2,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  return words[normalized] ?? null;
}

function collectFeatureResourceFallbacks(
  features: Array<{ name: string; text?: string | null }>,
  className: string | null | undefined,
  level: number,
): ResourceCounter[] {
  const fallback = new Map<string, ResourceCounter>();
  for (const feature of features) {
    const sourceLabel = String(feature.name ?? "").replace(/^Level\s+\d+\s*:\s*/i, "").trim();
    const text = String(feature.text ?? "").replace(/\s+/g, " ").trim();
    if (!sourceLabel || !text) continue;
    const escapedLabel = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fixedUseMatch = text.match(new RegExp(`you can use (?:the )?(?:${escapedLabel}|this feature)\\s+(once|twice|one|two|three|four|five|six|\\d+)`, "i"));
    const fixedUses = parseWordCount(fixedUseMatch?.[1] ?? "");
    const regainsOneOnShort = /regain one expended use when you finish a short rest/i.test(text);
    const regainsAllOnLong = /regain all expended uses when you finish a long rest/i.test(text);
    const regainsAllOnShortOrLong = /regain all expended uses when you finish a short or long rest/i.test(text);
    const regainsAllOnShort = /regain all expended uses when you finish a short rest/i.test(text);
    const reset =
      regainsOneOnShort ? "S"
      : regainsAllOnShortOrLong ? "SL"
      : regainsAllOnShort ? "S"
      : regainsAllOnLong ? "L"
      : null;
    if (!fixedUses || !reset) continue;
    const scaledMax = resolveResourceProgressionOverride(className, sourceLabel, level) ?? fixedUses;
    const key = normalizeResourceKey(sourceLabel);
    if (fallback.has(key)) continue;
    fallback.set(key, {
      key,
      name: sourceLabel,
      current: scaledMax,
      max: scaledMax,
      reset,
      restoreAmount: regainsOneOnShort ? "one" : "all",
    });
  }
  return Array.from(fallback.values());
}

function mergeResourceState(saved: ResourceCounter[] | undefined, derived: ResourceCounter[]): ResourceCounter[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedByKey = new Map(savedList.map((resource) => [resource.key || normalizeResourceKey(resource.name), resource]));
  const merged = derived.map((resource) => {
    const existing = savedByKey.get(resource.key);
    return {
      ...resource,
      restoreAmount: existing?.restoreAmount ?? resource.restoreAmount,
      current: Math.max(0, Math.min(resource.max, Math.floor(Number(existing?.current ?? resource.current) || 0))),
    };
  });
  const derivedKeys = new Set(merged.map((resource) => resource.key));
  const extras = savedList.filter((resource) => !derivedKeys.has(resource.key || normalizeResourceKey(resource.name)));
  return [...merged, ...extras];
}

function shouldResetOnRest(resetCode: string | undefined, restType: "short" | "long"): boolean {
  const code = String(resetCode ?? "").trim().toUpperCase();
  if (restType === "short") return code === "S";
  return code === "S" || code === "L";
}

function getPolymorphConditionData(conditions: ConditionInstance[] | undefined): PolymorphConditionData | null {
  return getPolymorphCondition(conditions) as PolymorphConditionData | null;
}

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
  const [polymorphMonster, setPolymorphMonster] = useState<any | null>(null);
  const [polymorphMonsterBusy, setPolymorphMonsterBusy] = useState(false);
  const [polymorphMonsterError, setPolymorphMonsterError] = useState<string | null>(null);
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
    const query = polymorphQuery.trim().toLowerCase();
    const maxCr = polymorphCrMax ? parseCrNumber(polymorphCrMax) : NaN;
    return polymorphRows
      .filter((row) => {
        if (query && !String(row.name ?? "").toLowerCase().includes(query)) return false;
        const type = String(row.type ?? "").trim().toLowerCase();
        if (polymorphTypeFilter !== "all" && type !== polymorphTypeFilter) return false;
        if (Number.isFinite(maxCr)) {
          const rowCr = parseCrNumber(row.cr);
          if (!Number.isFinite(rowCr) || rowCr > maxCr) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const crDiff = parseCrNumber(a.cr) - parseCrNumber(b.cr);
        if (Number.isFinite(crDiff) && Math.abs(crDiff) > 1e-9) return crDiff;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });
  }, [polymorphRows, polymorphQuery, polymorphTypeFilter, polymorphCrMax]);

  useEffect(() => {
    const classId = char?.characterData?.classId;
    if (!classId) {
      setClassDetail(null);
      return;
    }
    let alive = true;
    api<ClassRestDetail>(`/api/compendium/classes/${classId}`)
      .then((detail) => { if (alive) setClassDetail(detail ?? null); })
      .catch(() => { if (alive) setClassDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.classId]);

  useEffect(() => {
    const condition = getPolymorphConditionData(char?.conditions);
    const monsterId = typeof condition?.polymorphMonsterId === "string" && condition.polymorphMonsterId
      ? condition.polymorphMonsterId
      : null;
    if (!monsterId) {
      setPolymorphMonster(null);
      setPolymorphMonsterBusy(false);
      setPolymorphMonsterError(null);
      return;
    }
    let alive = true;
    setPolymorphMonsterBusy(true);
    setPolymorphMonsterError(null);
    api<any>(`/api/compendium/monsters/${encodeURIComponent(monsterId)}`)
      .then((monster) => { if (alive) setPolymorphMonster(monster); })
      .catch((e) => {
        if (alive) {
          setPolymorphMonster(null);
          setPolymorphMonsterError(e?.message ?? "Failed to load transformed form.");
        }
      })
      .finally(() => { if (alive) setPolymorphMonsterBusy(false); });
    return () => { alive = false; };
  }, [char?.conditions]);

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
    const raceId = char?.characterData?.raceId;
    if (!raceId) {
      setRaceDetail(null);
      return;
    }
    let alive = true;
    api<RaceFeatureDetail>(`/api/compendium/races/${raceId}`)
      .then((detail) => { if (alive) setRaceDetail(detail); })
      .catch(() => { if (alive) setRaceDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.raceId]);

  useEffect(() => {
    const bgId = char?.characterData?.bgId;
    if (!bgId) {
      setBackgroundDetail(null);
      return;
    }
    let alive = true;
    api<BackgroundFeatureDetail>(`/api/compendium/backgrounds/${bgId}`)
      .then((detail) => { if (alive) setBackgroundDetail(detail); })
      .catch(() => { if (alive) setBackgroundDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.bgId]);

  useEffect(() => {
    const featId = char?.characterData?.chosenRaceFeatId;
    if (!featId) {
      setRaceFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => { if (alive) setRaceFeatDetail(detail); })
      .catch(() => { if (alive) setRaceFeatDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.chosenRaceFeatId]);

  useEffect(() => {
    const featId = char?.characterData?.chosenBgOriginFeatId;
    if (!featId) {
      setBgOriginFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => { if (alive) setBgOriginFeatDetail(detail); })
      .catch(() => { if (alive) setBgOriginFeatDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.chosenBgOriginFeatId]);

  useEffect(() => {
    const entries = Object.entries(char?.characterData?.chosenClassFeatIds ?? {}).filter(([, featId]): featId is string =>
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
  }, [char?.characterData?.chosenClassFeatIds]);

  useEffect(() => {
    const entries = Array.isArray(char?.characterData?.chosenLevelUpFeats)
      ? char.characterData.chosenLevelUpFeats.filter((entry): entry is { level: number; featId: string } =>
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
  }, [char?.characterData?.chosenLevelUpFeats]);

  useEffect(() => {
    const invocationIds = Array.isArray(char?.characterData?.chosenInvocations)
      ? char.characterData.chosenInvocations.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    if (invocationIds.length === 0) {
      setInvocationDetails([]);
      return;
    }
    let alive = true;
    Promise.all(
      invocationIds.map(async (spellId) => {
        const detail = await api<any>(`/api/spells/${encodeURIComponent(spellId)}`);
        const text = Array.isArray(detail?.text)
          ? detail.text.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean).join("\n")
          : String(detail?.text ?? "").trim();
        return {
          id: spellId,
          name: String(detail?.name ?? spellId),
          text,
        } satisfies InvocationFeatureDetail;
      })
    )
      .then((details) => {
        if (alive) setInvocationDetails(details.filter((detail) => detail.text));
      })
      .catch(() => {
        if (alive) setInvocationDetails([]);
      });
    return () => { alive = false; };
  }, [char?.characterData?.chosenInvocations]);

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
    const source = char?.overrides ?? char?.characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
    setOverridesDraft({
      tempHp: Math.max(0, Math.floor(Number(source.tempHp ?? 0) || 0)),
      acBonus: Math.floor(Number(source.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(source.hpMaxBonus ?? 0) || 0),
    });
  }, [char?.overrides?.tempHp, char?.overrides?.acBonus, char?.overrides?.hpMaxBonus, char?.characterData?.sheetOverrides?.tempHp, char?.characterData?.sheetOverrides?.acBonus, char?.characterData?.sheetOverrides?.hpMaxBonus]);

  useEffect(() => {
    setColorDraft(char?.color ?? C.accentHl);
  }, [char?.color]);

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const rawProf = char.characterData?.proficiencies;
  const sanitizedTrackedSpells = dedupeTaggedItems(rawProf?.spells, normalizeSpellTrackingName)
    .filter((entry) => isLikelyTrackedSpellName(entry.name));
  const sanitizedArmor = dedupeTaggedItems(
    (rawProf?.armor ?? []).flatMap((entry) =>
      splitArmorProficiencyNames(entry?.name ?? "").map((name) => ({ ...entry, name }))
    ),
    normalizeArmorProficiencyName,
  );
  const prof = rawProf ? {
    ...rawProf,
    skills: dedupeTaggedItems(rawProf.skills),
    expertise: dedupeTaggedItems(rawProf.expertise),
    saves: dedupeTaggedItems(rawProf.saves),
    armor: sanitizedArmor,
    weapons: dedupeTaggedItems(rawProf.weapons, normalizeWeaponProficiencyName),
    tools: dedupeTaggedItems(rawProf.tools),
    languages: dedupeTaggedItems(rawProf.languages, normalizeLanguageName),
    masteries: dedupeTaggedItems(rawProf.masteries),
    spells: sanitizedTrackedSpells,
    invocations: dedupeTaggedItems(rawProf.invocations),
    maneuvers: dedupeTaggedItems(rawProf.maneuvers),
    plans: dedupeTaggedItems(rawProf.plans),
  } : undefined;
  const pb = proficiencyBonus(char.level);
  const hd = char.characterData?.hd ?? null;
  const hitDieSize = hd ?? classDetail?.hd ?? null;
  const hitDiceMax = Math.max(0, char.level);
  const hitDiceCurrent = Math.max(0, Math.min(hitDiceMax, Math.floor(Number(char.characterData?.hitDiceCurrent ?? hitDiceMax) || 0)));
  const scores: Record<AbilKey, number | null> = {
    str: char.strScore, dex: char.dexScore, con: char.conScore,
    int: char.intScore, wis: char.wisScore, cha: char.chaScore,
  };
  const _featureArgs = {
    charData: char.characterData,
    characterLevel: char.level,
    classDetail, raceDetail, backgroundDetail, bgOriginFeatDetail, raceFeatDetail,
    classFeatDetails: classFeatDetails.map((entry) => entry.feat),
    levelUpFeatDetails, invocationDetails,
  };
  const appliedFeatures = buildAppliedCharacterFeatures(_featureArgs);
  const classFeaturesList = buildDisplayPlayerFeatures(_featureArgs);
  const parsedFeatureEffects = appliedFeatures.map((feature, index) =>
    parseFeatureEffects({
      source: { id: `feature:${index}:${feature.id}`, kind: feature.kind, name: feature.name, text: feature.text },
      text: feature.text,
      suppressStructuredSpellGrants: Boolean(feature.preparedSpellProgression?.length),
    } satisfies ParseFeatureEffectsInput)
  );
  const progressionGrantedSpells = buildPreparedSpellProgressionGrants(appliedFeatures, char.level, char.characterData?.chosenFeatureChoices).map((entry) => ({
    key: entry.key,
    spellName: entry.spellName,
    sourceName: entry.sourceName,
    mode: "always_prepared" as const,
    note: entry.note,
  }));
  const grantedSpellData = (() => {
    const base = buildGrantedSpellDataFromEffects(parsedFeatureEffects, scores, char.level);
    const seen = new Set(base.spells.map((entry) => normalizeSpellTrackingKey(entry.spellName)));
    for (const spell of progressionGrantedSpells) {
      const normalized = normalizeSpellTrackingKey(spell.spellName);
      if (!normalized || seen.has(normalized)) continue;
      base.spells.push(spell);
      seen.add(normalized);
    }
    return base;
  })();
  const derivedResources = (() => {
    const byKey = new Map<string, ResourceCounter>();
    for (const resource of [
      ...collectClassResources(classDetail, char.level, char.characterData?.subclass ?? null),
      ...grantedSpellData.resources,
      ...collectFeatureResourceFallbacks(appliedFeatures, classDetail?.name ?? char.className ?? null, char.level),
    ]) {
      if (!byKey.has(resource.key)) byKey.set(resource.key, resource);
    }
    return Array.from(byKey.values());
  })();
  const classResourcesWithSpellCasts = mergeResourceState(char.characterData?.resources, derivedResources);
  const polymorphCondition = getPolymorphConditionData(char.conditions);
  const polymorphName = stripEditionTag(polymorphCondition?.polymorphName ?? "");
  const polymorphMonsterId = typeof polymorphCondition?.polymorphMonsterId === "string" && polymorphCondition.polymorphMonsterId
    ? polymorphCondition.polymorphMonsterId
    : null;
  const rageActive = (char.conditions ?? []).some((c) => c.key === "rage");
  const effectDefenses = collectDefensesFromEffects(parsedFeatureEffects, { raging: rageActive });
  const effectSenses = collectSensesFromEffects(parsedFeatureEffects);
  const parsedDefenses = {
    resistances: effectDefenses.resistances,
    damageImmunities: effectDefenses.damageImmunities,
    conditionImmunities: effectDefenses.conditionImmunities,
    vulnerabilities: [] as string[],
  };
  const isPactMagic = classDetail?.slotsReset === "S";
  const usesFlexiblePreparedList = usesFlexiblePreparedSpells(classDetail);
  const preparedSpellLimit = classDetail && !isPactMagic
    ? getPreparedSpellCount(classDetail, char.level, char.characterData?.subclass ?? "")
    : 0;
  const forcedPreparedSpellKeys = new Set(
    grantedSpellData.spells
      .filter((entry) => entry.mode === "always_prepared")
      .map((entry) => normalizeSpellTrackingKey(entry.spellName))
  );
  const knownSpellKeys = new Set((prof?.spells ?? []).map((entry) => normalizeSpellTrackingKey(entry.name)));
  const preparedSpells = (() => {
    const saved = Array.isArray(char.characterData?.preparedSpells) ? char.characterData.preparedSpells : [];
    const allowed = new Set([...knownSpellKeys, ...forcedPreparedSpellKeys]);
    const unique = Array.from(new Set(
      saved
        .map((entry) => normalizeSpellTrackingKey(entry))
        .filter((entry) => allowed.has(entry))
    ));
    const forced = unique.filter((entry) => forcedPreparedSpellKeys.has(entry));
    const userChosen = unique.filter((entry) => !forcedPreparedSpellKeys.has(entry));
    const limitedUserChosen = preparedSpellLimit > 0 ? userChosen.slice(0, preparedSpellLimit) : userChosen;
    return [...forced, ...limitedUserChosen];
  })();

  const accentColor = char.color ?? C.accentHl;
  const overrides: SheetOverrides = char.overrides ?? char.characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const featureHpMaxBonus = deriveHitPointMaxBonusFromEffects(parsedFeatureEffects, { level: char.level, scores });
  const effectiveHpMax = Math.max(1, char.hpMax + featureHpMaxBonus + (overrides.hpMaxBonus ?? 0));
  const xpEarned = char.characterData?.xp ?? 0;
  const xpNeeded = XP_TO_LEVEL[char.level + 1] ?? 0;
  const inventory = char.characterData?.inventory ?? [];
  const wornShield = inventory.find((it) => getEquipState(it) === "offhand" && isShieldItem(it));
  const shieldBonus = wornShield ? 2 : 0;
  const wornArmor = inventory.find((it) => getEquipState(it) === "worn" && isArmorItem(it) && (it.ac ?? 0) > 0);
  const speedArmorState =
    !wornArmor ? "no_armor"
    : /\bheavy armor\b/i.test(wornArmor.type ?? "") ? "any"
    : "not_heavy";
  const armorWithoutProficiency = Boolean(wornArmor && !hasArmorProficiency(wornArmor, prof ?? undefined));
  const shieldWithoutProficiency = Boolean(wornShield && !hasArmorProficiency(wornShield, prof ?? undefined));
  const nonProficientArmorPenalty = armorWithoutProficiency || shieldWithoutProficiency;
  const hasDisadvantage = (char.conditions ?? []).some((c) => c.key === "disadvantage");
  const stealthDisadvantage = Boolean((wornArmor && hasStealthDisadvantage(wornArmor)) || nonProficientArmorPenalty);
  const dexMod = abilityMod(char.dexScore);
  const conMod = abilityMod(char.conScore);
  const hasJackOfAllTrades = Boolean(
    classDetail?.autolevels
      ?.filter((autolevel) => autolevel.level <= char.level)
      .some((autolevel) => (autolevel.features ?? []).some((feature) => /jack of all trades/i.test(feature.name)))
  );
  const scoresByAbility: Record<AbilKey, number | null> = {
    str: char.strScore,
    dex: char.dexScore,
    con: char.conScore,
    int: char.intScore,
    wis: char.wisScore,
    cha: char.chaScore,
  };
  const wornArmorAc = (() => {
    if (!wornArmor || !wornArmor.ac) return null;
    const t = String(wornArmor.type ?? "").toLowerCase();
    if (t.includes("heavy")) return wornArmor.ac;
    if (t.includes("medium")) return wornArmor.ac + Math.min(2, dexMod);
    return wornArmor.ac + dexMod; // light armor
  })();
  const unarmoredDefenseAc = deriveUnarmoredDefenseFromEffects(parsedFeatureEffects, scoresByAbility, {
    armorEquipped: Boolean(wornArmor),
    shieldEquipped: Boolean(wornShield),
  });
  const featureAcBonus = deriveArmorClassBonusFromEffects(parsedFeatureEffects, {
    armorEquipped: Boolean(wornArmor),
    armorCategory:
      wornArmor && /\bheavy\b/i.test(wornArmor.type ?? "") ? "heavy"
      : wornArmor && /\bmedium\b/i.test(wornArmor.type ?? "") ? "medium"
      : wornArmor && /\blight\b/i.test(wornArmor.type ?? "") ? "light"
      : wornShield ? "shield"
      : "none",
    level: char.level,
    scores: scoresByAbility,
  });
  const effectiveAc = Math.max(char.ac, wornArmorAc ?? 0, unarmoredDefenseAc ?? 0) + featureAcBonus + (overrides.acBonus ?? 0) + shieldBonus;
  const speedBonus = deriveSpeedBonusFromEffects(parsedFeatureEffects, {
    armorState: speedArmorState,
    raging: rageActive,
  });
  const effectiveSpeed = char.speed + speedBonus;
  const movementModes = collectMovementModesFromEffects(parsedFeatureEffects, {
    baseWalkSpeed: effectiveSpeed,
    armorState: speedArmorState,
    raging: rageActive,
  });
  const tempHp = overrides.tempHp ?? 0;
  const hpPct = effectiveHpMax > 0 ? Math.max(0, Math.min(1, char.hpCurrent / effectiveHpMax)) : 0;
  const tempPct = effectiveHpMax > 0 ? Math.min(1 - hpPct, tempHp / effectiveHpMax) : 0;
  const passiveScoreBonus = deriveModifierBonusFromEffects(parsedFeatureEffects, "passive_score", {
    level: char.level,
    scores: scoresByAbility,
    raging: rageActive,
  });
  const passivePerc = getPassiveScore(getSkillBonus("Perception", "wis", scoresByAbility, char.level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const passiveInv  = getPassiveScore(getSkillBonus("Investigation", "int", scoresByAbility, char.level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const initiativeBonus = getInitiativeBonus(char.dexScore, char.level, { jackOfAllTrades: hasJackOfAllTrades })
    + deriveModifierBonusFromEffects(parsedFeatureEffects, "initiative", { level: char.level, scores: scoresByAbility, raging: rageActive });
  const transformedCombatStats = polymorphMonster ? (() => {
    const monsterDex = readMonsterNumber(polymorphMonster.dex) ?? 10;
    const monsterWis = readMonsterNumber(polymorphMonster.wis) ?? 10;
    const speedData = parseMonsterSpeed(polymorphMonster.speed);
    const skillPerception = readMonsterSkillBonus(polymorphMonster, "Perception");
    return {
      effectiveAc: readMonsterNumber(polymorphMonster.ac?.value ?? polymorphMonster.ac ?? polymorphMonster.armor_class) ?? effectiveAc,
      speed: speedData.walk ?? effectiveSpeed,
      movementModes: speedData.modes,
      initiativeBonus: abilityMod(monsterDex),
      pb: proficiencyBonusFromChallengeRating(polymorphMonster.cr ?? polymorphMonster.challenge_rating),
      passivePerc: skillPerception != null ? 10 + skillPerception : 10 + abilityMod(monsterWis),
      passiveInv,
      dexScore: monsterDex,
      strScore: readMonsterNumber(polymorphMonster.str) ?? char.strScore,
      className: polymorphMonster.name ?? char.className,
    };
  })() : null;
  const saveBonuses = Object.fromEntries(
    (Object.entries(ABILITY_FULL) as [AbilKey, string][]).map(([key, name]) => [
      key,
      deriveModifierBonusFromEffects(parsedFeatureEffects, "saving_throw", { appliesTo: name, level: char.level, scores: scoresByAbility, raging: rageActive }),
    ])
  ) as Partial<Record<AbilKey, number>>;
  const abilityCheckAdvantages: Partial<Record<AbilKey, boolean>> = {};
  const abilityCheckDisadvantages: Partial<Record<AbilKey, boolean>> = {};
  const saveAdvantages: Partial<Record<AbilKey, boolean>> = {};
  const saveDisadvantages: Partial<Record<AbilKey, boolean>> = {};
  (Object.keys(ABILITY_FULL) as AbilKey[]).forEach((ability) => {
    const abilityName = ABILITY_FULL[ability];
    const abilityCheckState = deriveModifierStateFromEffects(parsedFeatureEffects, "ability_check", { appliesTo: abilityName, raging: rageActive });
    const saveState = deriveModifierStateFromEffects(parsedFeatureEffects, "saving_throw", { appliesTo: abilityName, raging: rageActive });
    if (abilityCheckState.advantage) abilityCheckAdvantages[ability] = true;
    if (abilityCheckState.disadvantage) abilityCheckDisadvantages[ability] = true;
    if (saveState.advantage) saveAdvantages[ability] = true;
    if (saveState.disadvantage) saveDisadvantages[ability] = true;
  });
  const skillAdvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging: rageActive }).advantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
  const skillDisadvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging: rageActive }).disadvantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
  const rageDamageBonus = deriveAttackDamageBonusFromEffects(parsedFeatureEffects, {
    level: char.level,
    scores: scoresByAbility,
    raging: rageActive,
    attackAbility: "str",
    isWeapon: true,
  });
  const unarmedRageDamageBonus = deriveAttackDamageBonusFromEffects(parsedFeatureEffects, {
    level: char.level,
    scores: scoresByAbility,
    raging: rageActive,
    attackAbility: "str",
    isUnarmed: true,
  });
  const senses = effectSenses.map((sense) => `${sense.kind[0].toUpperCase()}${sense.kind.slice(1)} ${sense.range} ft.`);
  const editableOverrideFields: EditableSheetOverrideField[] = [
    { key: "tempHp", label: "Temp HP", help: "Current temporary hit points." },
    { key: "acBonus", label: "AC Bonus", help: "Bonus applied on top of normal armor class." },
    { key: "hpMaxBonus", label: "Max HP Modifier", help: "Bonus or penalty to maximum hit points." },
  ];
  const identityFields = [
    ["Alignment", char.characterData?.alignment],
    ["Gender", char.characterData?.gender],
    ["Age", char.characterData?.age],
    ["Height", char.characterData?.height],
    ["Weight", char.characterData?.weight],
    ["Hair", char.characterData?.hair],
    ["Skin", char.characterData?.skin],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);
  const currentCharacterData: CharacterData = char.characterData ?? {};

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
    skills: [], expertise: [], saves: [], armor: [], weapons: [], tools: [], languages: [], masteries: [], spells: [], invocations: [], maneuvers: [], plans: [],
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
    const nextUsedSpellSlots = /S/i.test(slotsReset) ? (char.characterData?.usedSpellSlots ?? {}) : {};
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
    const updated = await updateMyCharacter(char!.id, {
      name: char!.name,
      characterData: updatedData,
    });
    setChar((prev) => prev ? { ...prev, characterData: { ...(prev.characterData ?? {}), ...updatedData } } : prev);
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

  const playerNotesList: PlayerNote[] = char.characterData?.playerNotesList ?? [];
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
    // list = the full allSharedNotes after an edit/delete.
    // Persist only player-owned notes; separate out any campaign notes that were edited.
    const val = JSON.stringify(list);
    void api(`/api/me/characters/${char!.id}/sharedNotes`, jsonInit("PATCH", { sharedNotes: val }));
    // Also wipe local campaignSharedNotes so newly-saved player copies win in dedup
    setChar((prev) => prev ? { ...prev, sharedNotes: val, campaignSharedNotes: "[]" } : prev);
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

        {/* ── COL 1: HUD + Abilities & Saves + Skills + Proficiencies ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <CharacterHudPanel
          char={char}
          accentColor={accentColor}
          xpEarned={xpEarned}
          xpNeeded={xpNeeded}
          xpInput={xpInput}
          xpPopupOpen={xpPopupOpen}
          setXpInput={setXpInput}
          setXpPopupOpen={setXpPopupOpen}
          saveXp={saveXp}
          onOpenInfo={() => setInfoDrawerOpen(true)}
          onLevelUp={() => navigate(`/characters/${char.id}/levelup`)}
          onEdit={() => navigate(`/characters/${char.id}/edit`)}
          onPortraitClick={() => portraitFileRef.current?.click()}
          portraitUploading={portraitUploading}
          effectiveHpMax={effectiveHpMax}
          tempHp={tempHp}
          hpPct={hpPct}
          tempPct={tempPct}
          hpError={hpError}
          hpSaving={hpSaving}
          hpAmount={hpAmount}
          hd={hd}
          lastRoll={lastRoll}
          hpInputRef={hpInputRef}
          setHpError={setHpError}
          setLastRoll={setLastRoll}
          setHpAmount={setHpAmount}
          handleApplyHp={handleApplyHp}
          inspirationActive={overrides.inspiration ?? false}
          handleToggleInspiration={handleToggleInspiration}
          condPickerOpen={condPickerOpen}
          setCondPickerOpen={setCondPickerOpen}
          condSaving={condSaving}
          toggleCondition={toggleCondition}
          dsSaving={dsSaving}
          saveDeathSaves={saveDeathSaves}
          hpMaxBonus={overrides.hpMaxBonus ?? 0}
        />

          <CharacterAbilitiesPanels
            scores={scores}
            pb={pb}
            prof={prof}
            saveBonuses={saveBonuses}
            abilityCheckAdvantages={abilityCheckAdvantages}
            abilityCheckDisadvantages={abilityCheckDisadvantages}
            saveAdvantages={saveAdvantages}
            saveDisadvantages={saveDisadvantages}
            skillAdvantages={skillAdvantages}
            skillDisadvantages={skillDisadvantages}
            accentColor={accentColor}
            stealthDisadvantage={stealthDisadvantage}
            nonProficientArmorPenalty={nonProficientArmorPenalty}
            hasJackOfAllTrades={hasJackOfAllTrades}
            mod={abilityMod}
            fmtMod={formatModifier}
          />
          <CharacterDefensesPanel
            resistances={parsedDefenses.resistances}
            damageImmunities={parsedDefenses.damageImmunities}
            conditionImmunities={parsedDefenses.conditionImmunities}
            senses={senses}
            customResistances={char.characterData?.customResistances ?? []}
            customImmunities={char.characterData?.customImmunities ?? []}
            accentColor={accentColor}
            onCustomResistancesChange={(v) => { void saveCustomResistances(v); }}
            onCustomImmunitiesChange={(v) => { void saveCustomImmunities(v); }}
          />
          <CharacterProficienciesPanel prof={prof} accentColor={accentColor} />

        </div>
        {/* end COL 1 */}

        {/* ── COL 2: Actions + Spells & Invocations ────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CharacterCombatPanels
            effectiveAc={transformedCombatStats?.effectiveAc ?? effectiveAc}
            speed={transformedCombatStats?.speed ?? effectiveSpeed}
            movementModes={transformedCombatStats?.movementModes ?? movementModes}
            level={char.level}
            className={transformedCombatStats?.className ?? char.className}
            initiativeBonus={transformedCombatStats?.initiativeBonus ?? initiativeBonus}
            strScore={transformedCombatStats?.strScore ?? char.strScore}
            dexScore={transformedCombatStats?.dexScore ?? char.dexScore}
            pb={transformedCombatStats?.pb ?? pb}
            passivePerc={transformedCombatStats?.passivePerc ?? passivePerc}
            passiveInv={transformedCombatStats?.passiveInv ?? passiveInv}
            accentColor={accentColor}
            inventory={inventory}
            prof={prof}
            parsedFeatureEffects={parsedFeatureEffects}
            nonProficientArmorPenalty={nonProficientArmorPenalty}
            hasDisadvantage={hasDisadvantage}
            rageDamageBonus={rageDamageBonus}
            unarmedRageDamageBonus={unarmedRageDamageBonus}
            rageActive={rageActive}
            showActions={!polymorphCondition}
          />
          {polymorphCondition ? (
            polymorphMonster ? (
              <MonsterStatblock monster={polymorphMonster} hideSummaryBar />
            ) : polymorphMonsterBusy ? (
              <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.muted }}>
                Loading transformed form...
              </div>
            ) : polymorphMonsterError ? (
              <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.red }}>
                {polymorphMonsterError}
              </div>
            ) : (
              <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.muted }}>
                Transformed form details are unavailable right now.
              </div>
            )
          ) : (
            <>
              <ItemSpellsPanel
                items={inventory}
                pb={pb}
                intScore={char.intScore}
                wisScore={char.wisScore}
                chaScore={char.chaScore}
                accentColor={accentColor}
                onChargeChange={handleItemChargeChange}
                spellcastingBlocked={nonProficientArmorPenalty}
              />
              {/* Known / Prepared spells — rich table with inline slots */}
              <RichSpellsPanel
                spells={prof?.spells ?? []}
                grantedSpells={grantedSpellData.spells}
                resources={classResourcesWithSpellCasts}
                pb={pb}
                scores={scores}
                accentColor={accentColor}
                classDetail={classDetail}
                charLevel={char.level}
                preparedLimit={preparedSpellLimit}
                usesFlexiblePreparedList={usesFlexiblePreparedList}
                usedSpellSlots={char.characterData?.usedSpellSlots ?? {}}
                preparedSpells={preparedSpells}
                onSlotsChange={saveUsedSpellSlots}
                onPreparedChange={savePreparedSpells}
                onAddSpell={addTrackedSpell}
                onRemoveSpell={removeTrackedSpell}
                addSpellSourceLabel={classDetail?.name ?? char.className ?? "Manual"}
                onResourceChange={changeResourceCurrent}
                spellcastingBlocked={nonProficientArmorPenalty}
              />
            </>
          )}
        </div>
        {/* end COL 2 */}

        {/* ── COL 3: Inventory ─────────────────────────────────────────── */}
        <div>
          <InventoryPanel
            char={char}
            charData={char.characterData}
            parsedFeatureEffects={parsedFeatureEffects}
            accentColor={accentColor}
            campaignId={char.campaigns[0]?.campaignId ?? null}
            onSave={saveCharacterData}
          />
        </div>
        {/* end COL 3 */}
        {/* COL 4 */}
        <CharacterSupportPanels
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
        {/* end COL 4 */}

      </div>
      {/* end 4-column grid */}

      {polymorphDrawerOpen && (
        <RightDrawer
          onClose={() => setPolymorphDrawerOpen(false)}
          width="min(560px, 92vw)"
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: "var(--fs-subtitle)", letterSpacing: "0.08em", textTransform: "uppercase", color: accentColor }}>
                Transform Self
              </span>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
              Choose a creature form to polymorph into. Your current HP and AC bonuses are snapshotted, the form HP becomes your active pool, and if the form drops to 0 HP any overflow carries back into your original HP.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 8 }}>
              <input
                value={polymorphQuery}
                onChange={(e) => setPolymorphQuery(e.target.value)}
                placeholder="Search creatures..."
                style={{
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.panelBorder}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: "var(--fs-subtitle)",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              <select
                value={polymorphTypeFilter}
                onChange={(e) => setPolymorphTypeFilter(e.target.value)}
                style={{
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.panelBorder}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: "var(--fs-subtitle)",
                  outline: "none",
                  width: "100%",
                }}
              >
                {polymorphTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type === "all" ? "All types" : formatMonsterTypeLabel(type)}
                  </option>
                ))}
              </select>
              <input
                value={polymorphCrMax}
                onChange={(e) => setPolymorphCrMax(e.target.value)}
                placeholder="CR max"
                style={{
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.panelBorder}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: "var(--fs-subtitle)",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
              {polymorphRowsBusy ? "Loading creatures..." : `${filteredPolymorphRows.length} creature${filteredPolymorphRows.length === 1 ? "" : "s"}`}
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12 }}>
              {polymorphRowsError && (
                <div style={{ padding: 12, color: C.red, fontSize: "var(--fs-small)" }}>{polymorphRowsError}</div>
              )}
              {!polymorphRowsBusy && !polymorphRowsError && filteredPolymorphRows.length === 0 && (
                <div style={{ padding: 12, color: C.muted, fontSize: "var(--fs-small)" }}>No creatures match the current filters.</div>
              )}
              {filteredPolymorphRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  disabled={polymorphApplyingId !== null}
                  onClick={() => void applyPolymorphSelf(row)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: `1px solid ${C.panelBorder}`,
                    background: "transparent",
                    color: C.text,
                    textAlign: "left",
                    padding: "10px 12px",
                    cursor: polymorphApplyingId !== null ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, lineHeight: 1.2 }}>{row.name}</div>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                      {[row.type ? formatMonsterTypeLabel(row.type) : null, row.environment ? String(row.environment) : null].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ color: accentColor, fontSize: "var(--fs-small)", fontWeight: 800 }}>
                      CR {formatCr(row.cr)}
                    </span>
                    <span style={{ color: polymorphApplyingId === row.id ? C.muted : accentColor, fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {polymorphApplyingId === row.id ? "Applying..." : "Transform"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </RightDrawer>
      )}

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
      {infoDrawerOpen && (
        <>
          <div
            onClick={() => setInfoDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(7,10,18,0.55)",
              zIndex: 70,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "min(560px, 92vw)",
              height: "100vh",
              background: "#11182a",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-16px 0 40px rgba(0,0,0,0.45)",
              zIndex: 71,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--fs-hero)", fontWeight: 900, color: C.text, marginBottom: 4 }}>Character Information</div>
                <div style={{ fontSize: "var(--fs-subtitle)", color: C.muted }}>Identity details and sheet overrides.</div>
              </div>
              <button
                onClick={() => setInfoDrawerOpen(false)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: C.text,
                  fontWeight: 700,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 12 }}>Identity</div>
                {identityFields.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    {identityFields.map(([label, value]) => (
                      <div key={label} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: C.muted }}>
                    No character information filled in yet.
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 12 }}>Theme</div>
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sheet color</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Array.from(new Set([...SHEET_COLOR_PRESETS, colorDraft])).map((color) => {
                      const selected = colorDraft === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setColorDraft(color)}
                          title={color}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            cursor: "pointer",
                            padding: 0,
                            background: color,
                            border: `2px solid ${selected ? "#ffffff" : "rgba(255,255,255,0.16)"}`,
                            boxShadow: selected ? `0 0 0 3px ${color}66` : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 12 }}>Overrides</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                  {editableOverrideFields.map((field) => (
                    <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: "var(--fs-small)", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{field.label}</span>
                      <input
                        type="number"
                        value={overridesDraft[field.key]}
                        onChange={(e) => {
                          const value = e.target.value;
                          setOverridesDraft((prev) => ({
                            ...prev,
                            [field.key]: value === "" || value === "-" ? 0 : Number(value),
                          }));
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.05)",
                          color: C.text,
                          fontSize: "var(--fs-body)",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      />
                      <span style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.6)" }}>{field.help}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: 24, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setInfoDrawerOpen(false)}
                style={{
                  padding: "11px 18px",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: C.text,
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void saveSheetOverrides()}
                disabled={overridesSaving}
                style={{
                  padding: "11px 18px",
                  borderRadius: 12,
                  cursor: overridesSaving ? "default" : "pointer",
                  background: accentColor,
                  border: "none",
                  color: "#fff",
                  fontWeight: 800,
                  opacity: overridesSaving ? 0.7 : 1,
                }}
              >
                {overridesSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </Wrap>
  );
}

