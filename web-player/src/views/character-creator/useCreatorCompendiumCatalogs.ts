import React from "react";
import { api } from "@/services/api";
import {
  fetchBackgroundCatalog,
  fetchClassCatalog,
  fetchFeatCatalog,
  fetchRaceCatalog,
  type Ruleset,
} from "@/services/compendiumApi";
import type {
  BgSummary,
  Campaign,
  ClassSummary,
  RaceSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
export function useCreatorCompendiumCatalogs(ruleset: Ruleset | undefined) {
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [featSummaries, setFeatSummaries] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);

  React.useEffect(() => {
    if (!ruleset) return;
    fetchClassCatalog(ruleset).then((rows) => setClasses(rows as ClassSummary[])).catch(() => {});
    fetchRaceCatalog(ruleset).then((rows) => setRaces(rows as RaceSummary[])).catch(() => {});
    fetchBackgroundCatalog(ruleset).then((rows) => setBgs(rows as BgSummary[])).catch(() => {});
    fetchFeatCatalog(ruleset).then((rows) => setFeatSummaries(rows)).catch(() => {});
  }, [ruleset]);

  React.useEffect(() => {
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
