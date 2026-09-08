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
    let cancelled = false;
    setClasses([]);
    setRaces([]);
    setBgs([]);
    setFeatSummaries([]);
    if (!ruleset) return;
    fetchClassCatalog(ruleset).then((rows) => { if (!cancelled) setClasses(rows as ClassSummary[]); }).catch(() => {});
    fetchRaceCatalog(ruleset).then((rows) => { if (!cancelled) setRaces(rows as RaceSummary[]); }).catch(() => {});
    fetchBackgroundCatalog(ruleset).then((rows) => { if (!cancelled) setBgs(rows as BgSummary[]); }).catch(() => {});
    fetchFeatCatalog(ruleset).then((rows) => { if (!cancelled) setFeatSummaries(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [ruleset]);

  React.useEffect(() => {
    let cancelled = false;
    api<Campaign[]>("/api/me/campaigns").then((rows) => { if (!cancelled) setCampaigns(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return {
    classes,
    races,
    bgs,
    featSummaries,
    campaigns,
  };
}
