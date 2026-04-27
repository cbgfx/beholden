import React from "react";
import { fetchMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import type { CharacterCampaignAssignmentDto } from "@beholden/shared/api";
import {
  inferAbilityMethodFromScores,
  inferStandardAssignFromScores,
  type FormState,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { LevelUpFeatSelection } from "@/views/character-creator/utils/CharacterCreatorTypes";

type CreatorCharacterData = Record<string, unknown> & {
  classes?: Array<{ classId?: string; subclass?: string }>;
  bgAbilityBonuses?: Record<string, number>;
  chosenLevelUpFeats?: Array<{ level?: number; featId?: string; type?: string; abilityBonuses?: Record<string, number> }>;
  abilityMethod?: "pointbuy" | "standard" | string;
  raceId?: string;
  bgId?: string;
  chosenOptionals?: string[];
  chosenClassFeatIds?: Record<string, string>;
  chosenRaceSkills?: string[];
  chosenRaceLanguages?: string[];
  chosenRaceTools?: string[];
  chosenRaceFeatId?: string | null;
  chosenRaceSize?: string | null;
  chosenSkills?: string[];
  chosenBgOriginFeatId?: string | null;
  chosenClassLanguages?: string[];
  chosenClassEquipmentOption?: string | null;
  chosenBgEquipmentOption?: string | null;
  chosenFeatOptions?: Record<string, string[]>;
  chosenFeatureChoices?: Record<string, string[]>;
  chosenWeaponMasteries?: string[];
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  bgAbilityMode?: "split" | "even";
  standardAssign?: Record<string, number>;
  pbScores?: Record<string, number>;
  alignment?: string;
  hair?: string;
  skin?: string;
  height?: string;
  age?: string;
  weight?: string;
  gender?: string;
};

export function useCreatorEditHydration(args: {
  editId: string | undefined;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  setEditLoading: React.Dispatch<React.SetStateAction<boolean>>;
  initialCampaignIdsRef: React.MutableRefObject<string[]>;
}) {
  const { editId, setForm, setEditLoading, initialCampaignIdsRef } = args;

  React.useEffect(() => {
    if (!editId) return;
    fetchMyCharacter(editId)
      .then((ch) => {
        const cd: CreatorCharacterData = (ch.characterData ?? {}) as CreatorCharacterData;
        const primaryClassEntry = Array.isArray(cd.classes) ? cd.classes[0] : null;
        const recordedBgBonuses =
          cd.bgAbilityBonuses && typeof cd.bgAbilityBonuses === "object" ? cd.bgAbilityBonuses : {};
        const recordedAsiBonuses = Array.isArray(cd.chosenLevelUpFeats)
          ? cd.chosenLevelUpFeats.reduce((acc: Record<string, number>, entry) => {
              if (!entry?.abilityBonuses || typeof entry.abilityBonuses !== "object") return acc;
              Object.entries(entry.abilityBonuses).forEach(([key, value]) => {
                acc[key] = (acc[key] ?? 0) + (Number(value) || 0);
              });
              return acc;
            }, {})
          : {};
        const fallbackBaseScores = {
          str: Math.max(
            8,
            (ch.strScore ?? 10) -
              (Number(recordedBgBonuses.str ?? 0) || 0) -
              (Number(recordedAsiBonuses.str ?? 0) || 0),
          ),
          dex: Math.max(
            8,
            (ch.dexScore ?? 10) -
              (Number(recordedBgBonuses.dex ?? 0) || 0) -
              (Number(recordedAsiBonuses.dex ?? 0) || 0),
          ),
          con: Math.max(
            8,
            (ch.conScore ?? 10) -
              (Number(recordedBgBonuses.con ?? 0) || 0) -
              (Number(recordedAsiBonuses.con ?? 0) || 0),
          ),
          int: Math.max(
            8,
            (ch.intScore ?? 10) -
              (Number(recordedBgBonuses.int ?? 0) || 0) -
              (Number(recordedAsiBonuses.int ?? 0) || 0),
          ),
          wis: Math.max(
            8,
            (ch.wisScore ?? 10) -
              (Number(recordedBgBonuses.wis ?? 0) || 0) -
              (Number(recordedAsiBonuses.wis ?? 0) || 0),
          ),
          cha: Math.max(
            8,
            (ch.chaScore ?? 10) -
              (Number(recordedBgBonuses.cha ?? 0) || 0) -
              (Number(recordedAsiBonuses.cha ?? 0) || 0),
          ),
        };
        const savedAbilityMethod =
          cd.abilityMethod === "pointbuy" || cd.abilityMethod === "standard"
            ? cd.abilityMethod
            : inferAbilityMethodFromScores(fallbackBaseScores);
        const inferredStandardAssign = inferStandardAssignFromScores(fallbackBaseScores);
        setForm((f) => ({
          ...f,
          ruleset: "5.5e",
          classId: typeof primaryClassEntry?.classId === "string" ? primaryClassEntry.classId : "",
          raceId: cd.raceId ?? "",
          bgId: cd.bgId ?? "",
          level: ch.level ?? 1,
          subclass: typeof primaryClassEntry?.subclass === "string" ? primaryClassEntry.subclass : "",
          chosenOptionals: cd.chosenOptionals ?? [],
          chosenClassFeatIds: cd.chosenClassFeatIds ?? {},
          chosenLevelUpFeats: Array.isArray(cd.chosenLevelUpFeats)
            ? cd.chosenLevelUpFeats
                .map((entry) => ({
                  level: Number(entry?.level) || 0,
                  featId: typeof entry?.featId === "string" ? entry.featId : null,
                  type: entry?.type === "asi" ? "asi" as const : typeof entry?.featId === "string" ? "feat" as const : undefined,
                  abilityBonuses:
                    entry?.abilityBonuses && typeof entry.abilityBonuses === "object"
                      ? entry.abilityBonuses
                      : {},
                }))
                .filter((entry) => entry.level > 0 && entry.type) as LevelUpFeatSelection[]
            : [],
          chosenRaceSkills: cd.chosenRaceSkills ?? [],
          chosenRaceLanguages: cd.chosenRaceLanguages ?? [],
          chosenRaceTools: cd.chosenRaceTools ?? [],
          chosenRaceFeatId: cd.chosenRaceFeatId ?? null,
          chosenRaceSize: cd.chosenRaceSize ?? null,
          chosenSkills: cd.chosenSkills ?? [],
          chosenBgOriginFeatId: cd.chosenBgOriginFeatId ?? null,
          chosenClassLanguages: cd.chosenClassLanguages ?? [],
          chosenClassEquipmentOption: cd.chosenClassEquipmentOption ?? null,
          chosenBgEquipmentOption: cd.chosenBgEquipmentOption ?? null,
          chosenFeatOptions: cd.chosenFeatOptions ?? {},
          chosenFeatureChoices: cd.chosenFeatureChoices ?? {},
          chosenWeaponMasteries: cd.chosenWeaponMasteries ?? [],
          chosenCantrips: cd.chosenCantrips ?? [],
          chosenSpells: cd.chosenSpells ?? [],
          chosenInvocations: cd.chosenInvocations ?? [],
          bgAbilityMode: cd.bgAbilityMode === "even" ? "even" : "split",
          bgAbilityBonuses: recordedBgBonuses,
          abilityMethod: savedAbilityMethod,
          standardAssign:
            savedAbilityMethod === "standard"
              ? cd.standardAssign && typeof cd.standardAssign === "object"
                ? cd.standardAssign
                : inferredStandardAssign ?? f.standardAssign
              : f.standardAssign,
          pbScores:
            savedAbilityMethod === "pointbuy"
              ? cd.pbScores && typeof cd.pbScores === "object"
                ? cd.pbScores
                : fallbackBaseScores
              : f.pbScores,
          hpMax: String(ch.hpMax ?? 0),
          ac: String(ch.ac ?? 10),
          speed: String(ch.speed ?? 30),
          characterName: ch.name ?? "",
          playerName: ch.playerName ?? f.playerName,
          alignment: typeof cd.alignment === "string" ? cd.alignment : "",
          hair: typeof cd.hair === "string" ? cd.hair : "",
          skin: typeof cd.skin === "string" ? cd.skin : "",
          heightText: typeof cd.height === "string" ? cd.height : "",
          age: typeof cd.age === "string" ? cd.age : "",
          weight: typeof cd.weight === "string" ? cd.weight : "",
          gender: typeof cd.gender === "string" ? cd.gender : "",
          color: ch.color ?? C.accentHl,
          campaignIds: (ch.campaigns ?? []).map((campaign: CharacterCampaignAssignmentDto) => campaign.campaignId),
        }));
        initialCampaignIdsRef.current = (ch.campaigns ?? []).map((campaign: CharacterCampaignAssignmentDto) => campaign.campaignId);
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editId, initialCampaignIdsRef, setEditLoading, setForm]);
}
