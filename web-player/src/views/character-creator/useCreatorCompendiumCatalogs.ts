import React from "react";
import { api } from "@/services/api";
import {
  fetchBackgroundCatalog,
  fetchClassCatalog,
  fetchFeatCatalog,
  fetchRaceCatalog,
} from "@/services/compendiumApi";
import type {
  BgSummary,
  Campaign,
  ClassSummary,
  RaceSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { Ruleset } from "@/lib/characterRules";

export function useCreatorCompendiumCatalogs() {
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [featSummaries, setFeatSummaries] = React.useState<
    { id: string; name: string; ruleset?: Ruleset | null }[]
  >([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);

  React.useEffect(() => {
    fetchClassCatalog().then((rows) => setClasses(rows as ClassSummary[])).catch(() => {});
    fetchRaceCatalog().then((rows) => setRaces(rows as RaceSummary[])).catch(() => {});
    fetchBackgroundCatalog().then((rows) => setBgs(rows as BgSummary[])).catch(() => {});
    fetchFeatCatalog().then((rows) => setFeatSummaries(rows)).catch(() => {});
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
