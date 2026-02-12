import fs from "node:fs";
import { loadJson, saveJsonAtomic } from "../../lib/jsonFile.js";
import { asArray, asText, normalizeKey } from "../../lib/text.js";
import { normalizeHp } from "./normalizeHp.js";

function parseWeaponAttack(text) {
  const s = (text ?? "").toString();
  if (!s) return null;

  const melee =
    /Melee\s+Weapon\s+Attack/i.test(s) ||
    /Melee\s+or\s+Ranged\s+Weapon\s+Attack/i.test(s) ||
    /Melee\s+Attack\s+Roll/i.test(s) ||
    /Melee\s+Attack\b/i.test(s);

  const ranged =
    /Ranged\s+Weapon\s+Attack/i.test(s) ||
    /Melee\s+or\s+Ranged\s+Weapon\s+Attack/i.test(s) ||
    /Ranged\s+Attack\s+Roll/i.test(s) ||
    /Ranged\s+Attack\b/i.test(s);

  if ((!melee && !ranged) || !/\+\s*\d+/.test(s) || !/\bHit\s*:/i.test(s)) return null;

  const toHitMatch =
    s.match(/\+\s*(\d+)\s*to\s*hit/i) ||
    s.match(/Attack\s*Roll\s*:\s*\+\s*(\d+)/i) ||
    s.match(/Attack\s*:\s*\+\s*(\d+)/i);
  const toHit = toHitMatch ? Number(toHitMatch[1]) : null;

  let reach: string | null = null;
  const reachMatch = s.match(/reach\s*(\d+)\s*ft\.?/i);
  if (reachMatch) reach = `${reachMatch[1]} ft`;

  let range: string | null = null;
  const rangeMatch = s.match(/range\s*(\d+)\s*(?:\/\s*(\d+))?\s*ft\.?/i);
  if (rangeMatch) {
    range = rangeMatch[2] ? `${rangeMatch[1]}/${rangeMatch[2]} ft` : `${rangeMatch[1]} ft`;
  }

  let damage: string | null = null;
  let damageType: string | null = null;
  const dmgParen = s.match(/Hit:\s*[^\(]*\(\s*([^\)]+?)\s*\)\s*([A-Za-z]+)\s*damage/i);
  if (dmgParen) {
    damage = dmgParen[1].replace(/\s+/g, "");
    damageType = dmgParen[2].toLowerCase();
  } else {
    const dmgFlat = s.match(/Hit:\s*(\d+)\s*\(?[^\)]*\)?\s*([A-Za-z]+)\s*damage/i);
    if (dmgFlat) {
      damage = String(dmgFlat[1]);
      damageType = dmgFlat[2].toLowerCase();
    }
  }

  return {
    toHit: Number.isFinite(toHit) ? toHit : null,
    reach,
    range,
    melee,
    ranged,
    damage: damage ?? null,
    damageType: damageType ?? null,
  };
}

function normalizeCompendiumEntry(x) {
  if (!x) return null;
  const name = x.name ?? x.title;
  const text = x.text ?? x.description ?? "";
  const attack = parseWeaponAttack(text);
  return {
    ...x,
    name,
    text,
    attack,
  };
}

function pruneNone(v) {
  return asArray(v)
    .map(normalizeCompendiumEntry)
    .filter(Boolean)
    .filter((t) => {
      const txt = (t.text ?? "").toString().trim();
      if (!txt) return false;
      if (/^\(none\)$/i.test(txt)) return false;
      if (/^none$/i.test(txt)) return false;
      return true;
    });
}

function matchesFilters(m, f) {
  if (f.crMin != null && m.cr != null && Number(m.cr) < Number(f.crMin)) return false;
  if (f.crMax != null && m.cr != null && Number(m.cr) > Number(f.crMax)) return false;
  if (f.types?.length && !f.types.includes(m.typeKey)) return false;
  if (f.sizes?.length && !f.sizes.includes(m.size)) return false;
  if (f.environments?.length && !f.environments.includes(m.environment)) return false;
  return true;
}

export function createCompendium({ compendiumPath }) {
  type CompendiumState = { loaded: boolean; monsters: any[]; spells: any[]; items: any[] };
  const state: CompendiumState = { loaded: false, monsters: [] as any[], spells: [] as any[], items: [] as any[] };

  function load() {
    const raw = loadJson(compendiumPath, { version: 4, monsters: [] as any[], spells: [] as any[], items: [] as any[] });

    state.monsters = (raw.monsters ?? []).map((m) => {
      return {
        id: m.id,
        name: m.name,
        nameKey: m.name_key ?? m.nameKey ?? null,
        cr: m.cr ?? null,
        typeFull: m.type_full ?? m.typeFull ?? null,
        typeKey: m.type_key ?? m.typeKey ?? null,
        size: m.size ?? null,
        environment: m.environment ?? null,
        source: m.source ?? null,

        ac: m.ac ?? null,
        hp: normalizeHp(m.hp ?? null),
        speed: m.speed ?? null,
        str: m.str ?? null,
        dex: m.dex ?? null,
        con: m.con ?? null,
        int: m.int ?? null,
        wis: m.wis ?? null,
        cha: m.cha ?? null,

        save: m.save ?? null,
        skill: m.skill ?? null,
        senses: m.senses ?? null,
        languages: m.languages ?? null,
        immune: m.immune ?? null,
        resist: m.resist ?? null,
        vulnerable: m.vulnerable ?? null,
        conditionImmune: m.conditionImmune ?? null,

        trait: pruneNone(m.trait),
        action: pruneNone(m.action),
        reaction: pruneNone(m.reaction),
        legendary: pruneNone(m.legendary),
        spellcasting: pruneNone(m.spellcasting),
        spells: asArray(m.spells),
      };
    });

    state.spells = (raw.spells ?? [])
      .map((s) => {
        const displayName = asText(s?.name).trim();
        if (!displayName) return null;

        const fullKey = normalizeKey(asText(s?.name_key ?? s?.nameKey) || displayName);
        const id = s?.id ?? `s_${fullKey.replace(/\s/g, "_")}`;

        const baseName = displayName.replace(/\s*\[[^\]]+\]\s*$/, "").trim() || displayName;
        const baseKey = normalizeKey(baseName);

        const texts = Array.isArray(s?.text) ? s.text : s?.text != null ? [s.text] : [];
        return {
          id,
          name: displayName,
          nameKey: fullKey,
          baseName,
          baseKey,
          level: s?.level != null ? Number(s.level) : null,
          school: asText(s?.school) || (s?.school ?? null),
          time: asText(s?.time) || (s?.time ?? null),
          range: asText(s?.range) || (s?.range ?? null),
          components: asText(s?.components) || (s?.components ?? null),
          duration: asText(s?.duration) || (s?.duration ?? null),
          classes: s?.classes ?? null,
          text: texts,
        };
      })
      .filter(Boolean);

    state.items = (raw.items ?? []).map((it) => {
      const name = (it?.name ?? "Unknown").toString().trim();
      const nameKey = normalizeKey(it?.name_key ?? it?.nameKey ?? name);
      const id = it?.id ?? `i_${nameKey.replace(/\s/g, "_")}`;
      return {
        id,
        name,
        nameKey,
        rarity: it?.rarity ?? null,
        type: it?.type ?? null,
        typeKey: it?.type_key ?? it?.typeKey ?? null,
        attunement: Boolean(it?.attunement ?? false),
        text: it?.text != null ? String(it.text) : "",
      };
    });

    state.loaded = true;
  }

  function clear() {
    try {
      if (fs.existsSync(compendiumPath)) fs.unlinkSync(compendiumPath);
    } catch {
      // ignore
    }
    state.monsters = [];
    state.spells = [];
    state.items = [];
    state.loaded = false;
  }

  function searchMonsters(q, filters, limit) {
    const query = (q ?? "").toString().trim().toLowerCase();
    const f = filters ?? {};
    const out: any[] = [];
    const lim = typeof limit === "number" ? limit : 50;
    for (const m of state.monsters) {
      if (!matchesFilters(m, f)) continue;
      if (query) {
        const hay = `${m.name} ${m.typeFull ?? ""} ${m.environment ?? ""}`.toLowerCase();
        if (!hay.includes(query)) continue;
      }
      out.push(m);
      if (out.length >= lim) break;
    }
    return out;
  }

  function writeMerged(rawDoc) {
    saveJsonAtomic(compendiumPath, rawDoc);
    load();
  }

  // Initial load
  load();

  return {
    state,
    path: compendiumPath,
    load,
    clear,
    searchMonsters,
    writeMerged,
  };
}
