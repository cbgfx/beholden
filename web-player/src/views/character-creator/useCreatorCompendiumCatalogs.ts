import React from "react";
import { api } from "@/services/api";
import type { Ruleset } from "@/lib/characterRules";
import type {
  BgSummary,
  Campaign,
  ClassSummary,
  RaceSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";

export function useCreatorCompendiumCatalogs() {
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [featSummaries, setFeatSummaries] = React.useState<
    { id: string; name: string; ruleset?: Ruleset | null }[]
  >([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);

  React.useEffect(() => {
    api<ClassSummary[]>("/api/compendium/classes").then(setClasses).catch(() => {});
    api<RaceSummary[]>("/api/compendium/races").then(setRaces).catch(() => {});
    api<BgSummary[]>("/api/compendium/backgrounds").then(setBgs).catch(() => {});
    api<{ id: string; name: string; ruleset?: Ruleset | null }[]>("/api/compendium/feats")
      .then(setFeatSummaries)
      .catch(() => {});
    api<Campaign[]>("/api/me/campaigns").then(setCampaigns).catch(() => {});
  }, []);

  return {
    classes,
    races,
    bgs,
    featSummaries,
    campaigns,
  };
}
