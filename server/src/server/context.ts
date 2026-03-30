// server/src/server/context.ts
import type Database from "better-sqlite3";
import type { Multer } from "multer";
import type { BroadcastFn } from "./events.js";
import type { StoredCombatant, StoredPlayer } from "./userData.js";
import type os from "node:os";
import type fs from "node:fs";
import type path from "node:path";

export type Id = string;

export interface RuntimeConfig {
  appName: string;
  host: string;
  port: number;
  dataDir: string;
  dbPath?: string;
}

export interface Paths {
  dataDir: string;
  dbPath: string;
  webDistDir: string;
  hasWebDist: boolean;
  webPlayerDistDir: string;
  hasWebPlayerDist: boolean;
  repoRootDir: string;
}

export interface Helpers {
  now: () => number;
  uid: () => string;
  normalizeKey: (s: string) => string;
  parseLeadingInt: (s: unknown) => number | null;
  /** Compendium-facing HP normalization (keeps raw text but cleans HTML/bad formats). */
  normalizeHp: (hpVal: unknown) => unknown;
  /** Ensures a combat record exists for the encounter; creates it if missing. */
  ensureCombat: (encounterId: string) => void;
  nextLabelNumber: (encounterId: string, baseName: string) => number;
  createPlayerCombatant: (args: { encounterId: string; player: StoredPlayer; t?: number }) => StoredCombatant;
  seedDefaultConditions: (campaignId: string) => void;
  importCompendiumXml: (args: { xml: string }) => {
    imported: number;
    total: number;
    items?: number;
    classes?: number;
    races?: number;
    backgrounds?: number;
    feats?: number;
  };
  importCompendiumSqlite: (args: { buffer: Buffer }) => {
    imported: number;
    total: number;
    spells: number;
    items: number;
    classes: number;
    races: number;
    backgrounds: number;
    feats: number;
  };
}

export interface ServerContext {
  runtime: RuntimeConfig;
  paths: Paths;
  os: typeof os;
  fs: typeof fs;
  path: typeof path;
  /** better-sqlite3 Database instance — the single source of truth. */
  db: Database.Database;
  broadcast: BroadcastFn;
  upload: Multer;
  helpers: Helpers;
}
