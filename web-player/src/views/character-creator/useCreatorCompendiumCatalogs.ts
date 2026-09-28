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
  type CatalogName = "classes" | "species" | "backgrounds" | "feats";
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [featSummaries, setFeatSummaries] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [retryKey, setRetryKey] = React.useState(0);
  const [loadStates, setLoadStates] = React.useState<Record<CatalogName, "loading" | "failed" | "complete">>({
    classes: "loading", species: "loading", backgrounds: "loading", feats: "loading",
  });
  const retryCatalogs = () => setRetryKey((key) => key + 1);

  React.useEffect(() => {
    let cancelled = false;
    setClasses([]);
    setRaces([]);
    setBgs([]);
    setFeatSummaries([]);
    if (!ruleset) return;
    setLoadStates({ classes: "loading", species: "loading", backgrounds: "loading", feats: "loading" });
    const load = <T,>(name: CatalogName, request: Promise<T[]>, commit: (rows: T[]) => void) => request
      .then((rows) => { if (!cancelled) { commit(rows); setLoadStates((current) => ({ ...current, [name]: "complete" })); } })
      .catch(() => { if (!cancelled) setLoadStates((current) => ({ ...current, [name]: "failed" })); });
    void load("classes", fetchClassCatalog(ruleset), (rows) => setClasses(rows as ClassSummary[]));
    void load("species", fetchRaceCatalog(ruleset), (rows) => setRaces(rows as RaceSummary[]));
    void load("backgrounds", fetchBackgroundCatalog(ruleset), (rows) => setBgs(rows as BgSummary[]));
    void load("feats", fetchFeatCatalog(ruleset), setFeatSummaries);
    return () => { cancelled = true; };
  }, [ruleset, retryKey]);

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
    loadStates,
    retryCatalogs,
  };
}
