import type Database from "better-sqlite3";
import type { StoredEncounterActor } from "../server/userData.js";
import { extractLeadingNumber, extractDetails } from "../lib/text.js";
import { DEFAULT_OVERRIDES } from "../lib/defaults.js";
import { ensureCombat, insertCombatant, nextLabelNumber } from "./combat.js";

function parseMonsterStats(monsterBlob: unknown): {
  defaultHp: number | null;
  defaultAc: number | null;
  defaultHpDetails: string | null;
  defaultAcDetails: string | null;
} {
  const m = monsterBlob as Record<string, unknown>;
  const mHp = m?.hp as Record<string, unknown> | string | number | null | undefined;
  const mAc = m?.ac as unknown;
  const average = typeof mHp === "object" && mHp !== null ? mHp.average : mHp;
  return {
    defaultAc: extractLeadingNumber(mAc),
    defaultHp: extractLeadingNumber(average ?? mHp),
    defaultAcDetails: extractDetails(mAc),
    defaultHpDetails: (typeof mHp === "object" && mHp !== null
      ? ((mHp.formula ?? mHp.roll) as string | null | undefined)
      : null) ?? null,
  };
}

export interface AddMonsterParams {
  monsterId: string;
  monsterName: string;
  monsterBlob: unknown;
  qty: number;
  friendly: boolean;
  labelBase: string;
  acOverride: number | null;
  acDetails: string | null;
  hpMaxOverride: number | null;
  hpDetails: string | null;
  attackOverrides: unknown;
}

export function addMonsterCombatants(
  db: Database.Database,
  encounterId: string,
  uid: () => string,
  t: number,
  params: AddMonsterParams,
): StoredEncounterActor[] {
  const {
    monsterId, monsterName, monsterBlob, qty, friendly,
    labelBase, acOverride, acDetails, hpMaxOverride, hpDetails, attackOverrides,
  } = params;
  const { defaultHp, defaultAc, defaultHpDetails, defaultAcDetails } = parseMonsterStats(monsterBlob);

  ensureCombat(db, encounterId);

  const baseName = String(monsterName || "Monster").trim() || "Monster";
  const effectiveLabelBase = labelBase || baseName;
  const created: StoredEncounterActor[] = [];

  db.transaction(() => {
    let n = nextLabelNumber(db, encounterId, effectiveLabelBase);
    for (let i = 0; i < qty; i++) {
      const label = qty === 1 ? effectiveLabelBase : `${effectiveLabelBase} ${n++}`;
      const hpMax = hpMaxOverride != null ? hpMaxOverride : (defaultHp ?? null);
      const ac = acOverride != null ? acOverride : (defaultAc ?? null);
      const c: StoredEncounterActor = {
        id: uid(),
        encounterId,
        baseType: "monster",
        baseId: monsterId,
        name: baseName,
        label,
        initiative: null,
        friendly,
        color: friendly ? "lightgreen" : "red",
        overrides: { ...DEFAULT_OVERRIDES },
        hpCurrent: hpMax,
        hpMax,
        hpDetails: hpDetails != null ? hpDetails : defaultHpDetails != null ? String(defaultHpDetails) : null,
        ac,
        acDetails: acDetails != null ? acDetails : defaultAcDetails != null ? String(defaultAcDetails) : null,
        attackOverrides: attackOverrides ?? null,
        conditions: [],
        createdAt: t,
        updatedAt: t,
      };
      insertCombatant(db, c);
      created.push(c);
    }
  })();

  return created;
}
