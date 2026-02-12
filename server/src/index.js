
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import multer from "multer";
import { XMLParser } from "fast-xml-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

const DATA_DIR = path.join(__dirname, "..", "data");
const COMPENDIUM_PATH = path.join(DATA_DIR, "compendium.json");

// Campaign storage (v3): each campaign stored in its own json for easy export/backup.
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const CAMPAIGNS_INDEX_PATH = path.join(CAMPAIGNS_DIR, "index.json");
// NOTE: legacy userData.json migration has been removed (one-time only, not needed going forward).

fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });


fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultUserData = {
  version: 3,
  campaigns: {},
  adventures: {},
  encounters: {},
  notes: {},
  treasure: {},
  players: {},
  inpcs: {},
  conditions: {},
  combats: {}
};

function now(){ return Date.now(); }
function uid(){ return crypto.randomUUID(); }
function normalizeKey(s){ return (s ?? "").toString().trim().toLowerCase().replace(/\s+/g," "); }

function asText(v){
  if(v == null) return "";
  if(typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if(Array.isArray(v)) return asText(v[0]);
  if(typeof v === "object"){
    // Common XML parser shapes
    if(Object.prototype.hasOwnProperty.call(v, "#text")) return asText(v["#text"]);
    if(Object.prototype.hasOwnProperty.call(v, "_")) return asText(v["_"]);
    if(Object.prototype.hasOwnProperty.call(v, "text")) return asText(v["text"]);
    if(Object.prototype.hasOwnProperty.call(v, "value")) return asText(v["value"]);
  }
  return "";
}
function asArray(v){ if(!v) return []; return Array.isArray(v) ? v : [v]; }

// Challenge Rating parsing must support fractional CRs from XML like "1/2" and "1/4".
// NOTE: Do NOT strip non-digits naively ("1/2" -> "12").
function parseCrValue(raw){
  const s = String(raw ?? "").trim();
  if(!s) return null;

  // Fractions anywhere in the string: "CR 1/2", "1/4" etc.
  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if(frac){
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if(Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }

  // Decimal/integer anywhere in the string: "2", "0.5", "CR 10".
  const num = s.match(/-?\d+(?:\.\d+)?/);
  if(num){
    const n = Number(num[0]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function cleanDice(expr){
  return String(expr ?? "").replace(/\s+/g,"").trim();
}

function parseAttackFromText(text){
  const raw = String(text ?? "").trim();
  if(!raw) return null;

  // Match: "Melee Weapon Attack:" / "Ranged Weapon Attack:" / "Melee or Ranged Weapon Attack:"
  const head = raw.match(/^(Melee|Ranged|Melee or Ranged)\s+Weapon Attack:\s*\+?(\d+)\s*to hit,\s*([^.]*)\.\s*Hit:\s*([^]*)$/i);
  if(!head) return null;

  const mode = head[1].toLowerCase();
  const toHit = Number(head[2]);
  const meta = head[3] ?? "";
  const afterHit = head[4] ?? "";

  const melee = mode.includes("melee");
  const ranged = mode.includes("ranged");

  const reachMatch = meta.match(/reach\s*([^,]+)/i);
  const rangeMatch = meta.match(/range\s*([^,]+)/i);

  const reach = reachMatch ? String(reachMatch[1]).replace(/\./g,"").replace(/\s+/g,"") : null;
  const range = rangeMatch ? String(rangeMatch[1]).replace(/\./g,"").trim() : null;

  // Damage: "5 (1d6 + 2) piercing damage" or "Hit: 7 (2d6) slashing damage"
  const dmg = afterHit.match(/\(\s*([^)]+)\s*\)\s*([a-zA-Z]+)\s+damage/i);
  const damage = dmg ? cleanDice(dmg[1]) : null;
  const damageType = dmg ? String(dmg[2]).toLowerCase() : null;

  return {
    toHit: Number.isFinite(toHit) ? toHit : null,
    reach,
    range,
    melee,
    ranged,
    damage,
    damageType
  };
}

function applyAttackOverrideToText(text, override){
  const raw = String(text ?? "");
  if(!override) return raw;

  let out = raw;

  if(typeof override.toHit === "number" && Number.isFinite(override.toHit)){
    out = out.replace(/Weapon Attack:\s*\+?\d+\s*to hit/i, (m)=> m.replace(/\+?\d+/, `+${override.toHit}`));
  }
  if(override.damage){
    out = out.replace(/\(\s*[^)]+\s*\)\s*[a-zA-Z]+\s+damage/i, (m)=>{
      const type = override.damageType ? String(override.damageType) : (m.match(/\)\s*([a-zA-Z]+)\s+damage/i)?.[1] ?? "");
      return `(${override.damage}) ${type} damage`;
    });
  }
  if(override.damageType){
    out = out.replace(/\)\s*[a-zA-Z]+\s+damage/i, `) ${override.damageType} damage`);
  }
  return out;
}

function loadJson(filePath, fallback){
  try{
    if(!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    if(!raw.trim()) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function saveJsonAtomic(filePath, data){
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}


function buildEmptyUserData(){
  return {
    version: 3,
    campaigns: {},
    adventures: {},
    encounters: {},
    notes: {},
    treasure: {},
    players: {},
    inpcs: {},
    conditions: {},
    combats: {}
  };
}

function campaignFilePath(campaignId){
  return path.join(CAMPAIGNS_DIR, `${campaignId}.json`);
}

function loadCampaignIndex(){
  return loadJson(CAMPAIGNS_INDEX_PATH, { version: 1, campaigns: {} });
}

function saveCampaignIndexAtomic(index){
  saveJsonAtomic(CAMPAIGNS_INDEX_PATH, index);
}

function loadAllCampaignFiles(){
  const idx = loadCampaignIndex();
  const ud = buildEmptyUserData();

  const campaignIds = Object.keys(idx.campaigns ?? {});
  for(const campaignId of campaignIds){
    const fp = campaignFilePath(campaignId);
    const doc = loadJson(fp, null);
    if(!doc) continue;

    ud.campaigns[campaignId] = doc.campaign ?? idx.campaigns[campaignId];
    Object.assign(ud.adventures, doc.adventures ?? {});
    Object.assign(ud.encounters, doc.encounters ?? {});
    Object.assign(ud.notes, doc.notes ?? {});
    Object.assign(ud.treasure, doc.treasure ?? {});
    Object.assign(ud.players, doc.players ?? {});
    Object.assign(ud.inpcs, doc.inpcs ?? {});
    Object.assign(ud.conditions, doc.conditions ?? {});
    Object.assign(ud.combats, doc.combats ?? {});
  }

  return ud;
}

function persistCampaignStorageFromUserData(){
  const index = { version: 1, campaigns: {} };

  const campaignIds = Object.keys(userData.campaigns ?? {});
  for(const campaignId of campaignIds){
    const campaign = userData.campaigns[campaignId];
    index.campaigns[campaignId] = campaign;

    const adventures = {};
    const encounters = {};
    const notes = {};
    const treasure = {};
    const players = {};
    const inpcs = {};
    const conditions = {};
    const combats = {};

    for(const [id,a] of Object.entries(userData.adventures)) if(a?.campaignId===campaignId) adventures[id]=a;
    for(const [id,e] of Object.entries(userData.encounters)) if(e?.campaignId===campaignId) encounters[id]=e;
    for(const [id,n] of Object.entries(userData.notes)) if(n?.campaignId===campaignId) notes[id]=n;
    for(const [id,t] of Object.entries(userData.treasure)) if(t?.campaignId===campaignId) treasure[id]=t;
    for(const [id,p] of Object.entries(userData.players)) if(p?.campaignId===campaignId) players[id]=p;
    for(const [id,i] of Object.entries(userData.inpcs)) if(i?.campaignId===campaignId) inpcs[id]=i;
    for(const [id,c] of Object.entries(userData.conditions)) if(c?.campaignId===campaignId) conditions[id]=c;

    for(const [encId,combat] of Object.entries(userData.combats)){
      const enc = userData.encounters[encId];
      if(enc?.campaignId===campaignId) combats[encId]=combat;
    }

    const doc = { version: 1, campaign, adventures, encounters, notes, treasure, players, inpcs, conditions, combats };
    saveJsonAtomic(campaignFilePath(campaignId), doc);
  }

  // IMPORTANT: do not auto-delete campaign files that are not present in memory.
  // If the index ever gets out of sync (e.g. crash, partial write, manual edits),
  // an "auto cleanup" can wipe data unexpectedly. Campaign deletion should be an
  // explicit user action.

  saveCampaignIndexAtomic(index);
}

function ensureCampaignIndexExists(){
  if(fs.existsSync(CAMPAIGNS_INDEX_PATH)) return;
  saveCampaignIndexAtomic({ version: 1, campaigns: {} });
}

let userData = buildEmptyUserData();
ensureCampaignIndexExists();
userData = loadAllCampaignFiles();

let saveTimer = null;
function scheduleSave(){
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistCampaignStorageFromUserData();
  }, 150);
}

function nextSort(items){
  return items.reduce((m,x)=>Math.max(m, Number.isFinite(x?.sort) ? x.sort : 0), 0) + 1;
}
function bySortThenUpdatedDesc(a,b){
  const as = Number.isFinite(a?.sort) ? a.sort : 1e9;
  const bs = Number.isFinite(b?.sort) ? b.sort : 1e9;
  if (as !== bs) return as - bs;
  return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
}

let wss = null;
function broadcast(type, payload){
  if(!wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const ws of wss.clients){
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function seedDefaultConditions(campaignId){
  const defaults = [
    ["Blinded","condition"],["Charmed","condition"],["Deafened","condition"],["Frightened","condition"],["Grappled","condition"],
    ["Incapacitated","condition"],["Invisible","condition"],["Paralyzed","condition"],["Petrified","condition"],["Poisoned","condition"],
    ["Prone","condition"],["Restrained","condition"],["Stunned","condition"],["Unconscious","condition"],
    ["Hex","spell"],["Concentrating","spell"],["Marked","marker"]
  ];
  const t = now();
  for(let i=0;i<defaults.length;i++){
    const [name, category] = defaults[i];
    const nameKey = normalizeKey(name);
    const id = `cond_${campaignId}_${nameKey.replace(/\s/g,"_")}`;
    if(userData.conditions[id]) continue;
    userData.conditions[id] = { id, campaignId, name, nameKey, category, color:null, sortOrder:i+1, isBuiltin:true, createdAt:t, updatedAt:t };
  }
}

const compendiumState = { loaded:false, monsters:[], spells:[], items:[] };

function parseWeaponAttack(text){
  const s = (text ?? "").toString();
  if(!s) return null;

  // Weapon attacks show up in a bunch of compendium formats. Support the common
  // "Melee Weapon Attack" / "Ranged Weapon Attack" lines, plus newer sources that
  // render as "Melee Attack Roll".
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

  // If it doesn't look like an attack line (needs a hit bonus + a Hit clause), skip.
  if((!melee && !ranged) || !/\+\s*\d+/.test(s) || !/\bHit\s*:/i.test(s)) return null;

  // Common: "+4 to hit". Some sources omit "to hit" and just do "Attack Roll: +4".
  const toHitMatch =
    s.match(/\+\s*(\d+)\s*to\s*hit/i) ||
    s.match(/Attack\s*Roll\s*:\s*\+\s*(\d+)/i) ||
    s.match(/Attack\s*:\s*\+\s*(\d+)/i);
  const toHit = toHitMatch ? Number(toHitMatch[1]) : null;

  let reach = null;
  const reachMatch = s.match(/reach\s*(\d+)\s*ft\.?/i);
  if(reachMatch) reach = `${reachMatch[1]} ft`;

  let range = null;
  // e.g. "range 20/60 ft." or "range 30 ft."
  const rangeMatch = s.match(/range\s*(\d+)\s*(?:\/\s*(\d+))?\s*ft\.?/i);
  if(rangeMatch){
    range = rangeMatch[2] ? `${rangeMatch[1]}/${rangeMatch[2]} ft` : `${rangeMatch[1]} ft`;
  }

  // Prefer dice expression from parentheses: Hit: 5 (1d4 + 3) bludgeoning damage.
  let damage = null;
  let damageType = null;
  const dmgParen = s.match(/Hit:\s*[^\(]*\(\s*([^\)]+?)\s*\)\s*([A-Za-z]+)\s*damage/i);
  if(dmgParen){
    damage = dmgParen[1].replace(/\s+/g, "");
    damageType = dmgParen[2].toLowerCase();
  } else {
    // Fallback: Hit: 7 slashing damage.
    const dmgFlat = s.match(/Hit:\s*(\d+)\s*\(?[^\)]*\)?\s*([A-Za-z]+)\s*damage/i);
    if(dmgFlat){
      // We don't know dice, but store the flat number as-is.
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
    damageType: damageType ?? null
  };
}

function normalizeCompendiumEntry(x){
  if(!x) return null;
  const name = x.name ?? x.title;
  const text = x.text ?? x.description ?? "";
  const attack = parseWeaponAttack(text);
  return {
    ...x,
    name,
    text,
    attack
  };
}

function pruneNone(v){
  return asArray(v)
    .map(normalizeCompendiumEntry)
    .filter(Boolean)
    .filter((t)=>{
      const txt = (t.text ?? "").toString().trim();
      if(!txt) return false;
      if(/^\(none\)$/i.test(txt)) return false;
      if(/^none$/i.test(txt)) return false;
      return true;
    });
}

function loadCompendium(){
  const raw = loadJson(COMPENDIUM_PATH, { version: 4, monsters: [], spells: [], items: [] });

  compendiumState.monsters = (raw.monsters ?? []).map((m)=> {
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

      // NOTE: we only keep the normalized/text+attack-parsed form; we do not store raw statblocks.
      trait: pruneNone(m.trait),
      action: pruneNone(m.action),
      reaction: pruneNone(m.reaction),
      legendary: pruneNone(m.legendary),
      spellcasting: pruneNone(m.spellcasting),
      spells: asArray(m.spells)
    };
  });

compendiumState.spells = (raw.spells ?? []).map((s) => {
    // Spell identity must NOT collapse variants like "Aid" vs "Aid [2024]".
    // Use the full display name for id/nameKey. The bracket-stripped name is stored separately
    // for loose searching only.
    const displayName = (asText(s?.name) || "Unknown").trim();
    const fullKey = normalizeKey(asText(s?.name_key ?? s?.nameKey) || displayName);
    const id = s?.id ?? `s_${fullKey.replace(/\s/g,"_")}`;

    const baseName = displayName.replace(/\s*\[[^\]]+\]\s*$/,"").trim() || displayName;
    const baseKey = normalizeKey(baseName);

    const texts = Array.isArray(s?.text) ? s.text : (s?.text != null ? [s.text] : []);
    return {
      id,
      name: displayName,
      nameKey: fullKey,
      baseName,
      baseKey,
      level: s?.level != null ? Number(s.level) : null,
      school: s?.school ?? null,
      time: s?.time ?? null,
      range: s?.range ?? null,
      components: s?.components ?? null,
      duration: s?.duration ?? null,
      classes: s?.classes ?? null,
      text: texts
    };
  });

  compendiumState.items = (raw.items ?? []).map((it) => {
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
      text: it?.text != null ? String(it.text) : ""
    };
  });

  compendiumState.loaded = true;
}

loadCompendium();

function matchesFilters(m,f){
  if(f.crMin!=null && m.cr!=null && Number(m.cr) < Number(f.crMin)) return false;
  if(f.crMax!=null && m.cr!=null && Number(m.cr) > Number(f.crMax)) return false;
  if(f.types?.length && !f.types.includes(m.typeKey)) return false;
  if(f.sizes?.length && !f.sizes.includes(m.size)) return false;
  if(f.environments?.length && !f.environments.includes(m.environment)) return false;
  return true;
}

function searchCompendium(q, filters, limit){
  const query = (q ?? "").toString().trim().toLowerCase();
  const f = filters ?? {};
  const out = [];
  for(const m of compendiumState.monsters){
    if(!matchesFilters(m,f)) continue;
    if(query){
      const hay = `${m.name} ${m.typeFull ?? ""} ${m.environment ?? ""}`.toLowerCase();
      if(!hay.includes(query)) continue;
    }
    out.push(m);
    if(out.length >= limit) break;
  }
  return out;
}

function ensureCombat(encounterId){
  if(!userData.combats[encounterId]){
    userData.combats[encounterId] = {
      encounterId,
      round: 1,
      activeIndex: 0,
      activeCombatantId: null,
      createdAt: now(),
      updatedAt: now(),
      combatants: []
    };
  }
  return userData.combats[encounterId];
}

function nextLabelNumber(encounterId, baseName){
  const combat = ensureCombat(encounterId);
  // Match labels like "Goblin 2" (case-insensitive), but only for this baseName.
  const rx = new RegExp(
    "^" + baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\d+)$",
    "i"
  );
  let maxN = 0;
  for(const c of combat.combatants){
    const m = String(c.label ?? "").match(rx);
    if(m){
      const n = Number(m[1]);
      if(Number.isFinite(n)) maxN = Math.max(maxN, n);
    }
  }
  return maxN + 1;
}

const app = express();
app.use(cors({ origin:true }));
app.use(express.json({ limit:"10mb" }));

// --- Compendium helpers ------------------------------------------------------
function avgFromDiceFormula(formula){
  if(!formula) return null;
  const s = String(formula).replace(/\s+/g, "").toLowerCase();
  // Supports: NdM, NdM+K, NdM-K (e.g., 8d12+24)
  const m = s.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if(!m) return null;
  const n = Number(m[1]);
  const die = Number(m[2]);
  const mod = m[3] ? Number(m[3]) : 0;
  if(!Number.isFinite(n) || !Number.isFinite(die) || !Number.isFinite(mod) || n<=0 || die<=0) return null;
  // Average of a die is (die+1)/2; compendiums typically floor halves.
  const avg = n * ((die + 1) / 2) + mod;
  return Number.isFinite(avg) ? Math.floor(avg) : null;
}

function normalizeHp(hpVal){
  if(hpVal == null) return hpVal;
  if(typeof hpVal !== "string") return hpVal;
  const s = hpVal.trim();
  if(!s) return s;

  // Strip simple xml tags if present (e.g., "<hp>76 (8d12+24)</hp>")
  const plain = s.replace(/<\/?[^>]+>/g, "").trim();

  // If we can compute average from dice formula, and it clearly disagrees with the parsed number,
  // prefer the computed value. This fixes import cases where only the first digit was captured.
  const numMatch = plain.match(/-?\d+/);
  const parsed = numMatch ? Number(numMatch[0]) : null;
  const formulaMatch = plain.match(/\(([^)]+)\)/);
  const formula = formulaMatch ? formulaMatch[1] : null;
  const avg = avgFromDiceFormula(formula);

  if(Number.isFinite(avg) && Number.isFinite(parsed)){
    // Example: "7 (8d12+24)" should be "76 (8d12+24)" when the import captured only the first digit.
    // Only replace when the parsed number is clearly a truncated prefix of the computed average.
    const parsedStr = String(parsed);
    const avgStr = String(avg);
    if(avg >= 10 && parsedStr.length < avgStr.length && avgStr.startsWith(parsedStr)){
      // Replace only the first number occurrence
      return plain.replace(/-?\d+/, avgStr);
    }
  }

  return plain;
}

app.get("/api/health", (_req,res)=>res.json({ ok:true, time: now() }));
app.post("/api/campaigns/:campaignId/fullRest", (req,res)=>{
  const { campaignId } = req.params;
  const campaign = userData.campaigns[campaignId];
  if(!campaign) return res.status(404).json({ ok:false, message:"Campaign not found" });

  const t = now();

  // 1) Fully heal all players in this campaign.
  const players = Object.values(userData.players).filter(p=>p.campaignId===campaignId);
  for(const p of players){
    userData.players[p.id] = { ...p, hpCurrent: p.hpMax, updatedAt: t };
  }

  // 2) Sync any player combatants across this campaign's encounters.
  //    Also clear combatant conditions and temp HP.
  const encounters = Object.values(userData.encounters).filter(e=>e.campaignId===campaignId);
  const updatedEncounterIds = [];
  for(const enc of encounters){
    const combat = userData.combats[enc.id];
    if(!combat) continue;

    let changed = false;
    const nextCombatants = combat.combatants.map((c)=>{
      if(c.baseType !== "player") return c;
      const p = userData.players[c.baseId];
      if(!p) return c;

      changed = true;
      return {
        ...c,
        hpCurrent: p.hpMax,
        hpMax: p.hpMax,
        conditions: [],
        overrides: {
          ...c.overrides,
          tempHp: 0
        },
        updatedAt: t
      };
    });

    if(changed){
      userData.combats[enc.id] = { ...combat, combatants: nextCombatants, updatedAt: t };
      updatedEncounterIds.push(enc.id);
    }
  }

  scheduleSave();
  broadcast("players:changed", { campaignId });
  for(const encounterId of updatedEncounterIds){
    broadcast("encounter:combatantsChanged", { encounterId });
  }

  res.json({ ok:true, playersUpdated: players.length, encountersUpdated: updatedEncounterIds.length });
});

app.get("/api/meta", (_req,res)=>{
  const ips = [];
  const nics = os.networkInterfaces();
  for (const name of Object.keys(nics)){
    for (const ni of nics[name] ?? []){
      if(ni.family==="IPv4" && !ni.internal) ips.push(ni.address);
    }
  }
  res.json({ ok:true, host:HOST, port:PORT, ips, dataDir: DATA_DIR, hasCompendium: fs.existsSync(COMPENDIUM_PATH) });
});

/* Compendium */
app.get("/api/compendium/monsters/:monsterId", (req,res)=>{
  const { monsterId } = req.params;
  const m = compendiumState.monsters.find(x => x.id === monsterId);
  if(!m) return res.status(404).json({ ok:false, message:"Monster not found in compendium" });

  res.json({
    id: m.id,
    name: m.name,
    nameKey: m.nameKey,
    cr: m.cr ?? null,
    xp: m.xp ?? null,
    typeFull: m.typeFull ?? null,
    typeKey: m.typeKey ?? null,
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

    trait: m.trait ?? [],
    action: m.action ?? [],
    reaction: m.reaction ?? [],
    legendary: m.legendary ?? [],
    spellcasting: m.spellcasting ?? [],
    spells: m.spells ?? []
  });
});


// Lightweight index// Lightweight index for the full compendium list (used by Monster Picker).
// Returns ALL monsters (no pagination) with only the fields needed for client-side filtering/sorting.
app.get("/api/compendium/monsters", (_req, res) => {
  //ensureCompendiumLoaded();

  const rows = compendiumState.monsters.map((m) => {
    const raw = m;
    // Prefer raw json for these fields; our compendium imports can vary in shape.
    const rawCr = raw?.cr ?? raw?.challenge_rating;
    const mCr = m?.cr;
    // Some imports collapse fractions ("1/4" -> "14") in the summary field. Prefer raw fractions.
    const cr =
      (typeof rawCr === "string" && rawCr.trim().includes("/")
        ? rawCr.trim()
        : rawCr ??
          (typeof mCr === "string" && mCr.trim().includes("/") ? mCr.trim() : mCr) ??
          0);

    const env = (() => {
      const v = raw?.environment ?? raw?.environments ?? m?.environment;
      if (Array.isArray(v)) return v.join(", ");
      if (typeof v === "string") return v;
      return "";
    })();

    const type = (() => {
      const v = raw?.type ?? m?.type;
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && typeof v.type === "string") return v.type;
      return "";
    })();

    return {
      id: m.id,
      name: m.name,
      cr,
      type,
      environment: env,
    };
  });

  res.json(rows);
});

// Lightweight index for items (used by Item Picker).
app.get("/api/compendium/items", (_req, res) => {
  const rows = compendiumState.items.map((it) => ({
    id: it.id,
    name: it.name,
    rarity: it.rarity ?? null,
    type: it.type ?? null,
    typeKey: it.typeKey ?? null,
    attunement: Boolean(it.attunement)
  }));
  res.json(rows);
});

app.get("/api/compendium/items/:itemId", (req, res) => {
  const { itemId } = req.params;
  const it = compendiumState.items.find((x) => x.id === itemId);
  if (!it) return res.status(404).json({ ok: false, message: "Item not found in compendium" });
  res.json({
    id: it.id,
    name: it.name,
    nameKey: it.nameKey,
    rarity: it.rarity ?? null,
    type: it.type ?? null,
    typeKey: it.typeKey ?? null,
    attunement: Boolean(it.attunement),
    text: it.text ?? ""
  });
});

/* Campaigns */
app.get("/api/campaigns", (_req,res)=>{
  const rows = Object.values(userData.campaigns).sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.post("/api/campaigns", (req,res)=>{
  const name = (req.body?.name ?? "").toString().trim() || "New Campaign";
  const id = uid();
  const t = now();
  userData.campaigns[id] = { id, name, color:null, createdAt:t, updatedAt:t };
  seedDefaultConditions(id);
  scheduleSave();
  broadcast("campaigns:changed", { campaignId: id });
  res.json(userData.campaigns[id]);
});

app.put("/api/campaigns/:campaignId", (req,res)=>{
  const { campaignId } = req.params;
  const c = userData.campaigns[campaignId];
  if(!c) return res.status(404).json({ ok:false, message:"Campaign not found" });
  const name = (req.body?.name ?? "").toString().trim() || c.name;
  const t = now();
  userData.campaigns[campaignId] = { ...c, name, updatedAt: t };
  scheduleSave();
  broadcast("campaigns:changed", { campaignId });
  res.json(userData.campaigns[campaignId]);
});

app.delete("/api/campaigns/:campaignId", (req,res)=>{
  const { campaignId } = req.params;
  const c = userData.campaigns[campaignId];
  if(!c) return res.status(404).json({ ok:false, message:"Campaign not found" });

  const advIds = Object.values(userData.adventures).filter(a=>a.campaignId===campaignId).map(a=>a.id);
  const encIds = Object.values(userData.encounters).filter(e=>e.campaignId===campaignId).map(e=>e.id);

  for(const id of advIds){ delete userData.adventures[id]; }
  for(const id of encIds){
    delete userData.encounters[id];
    delete userData.combats[id];
  }

  for(const n of Object.values(userData.notes)){
    if(n.campaignId===campaignId) delete userData.notes[n.id];
  }
  for(const p of Object.values(userData.players)){
    if(p.campaignId===campaignId) delete userData.players[p.id];
  }
  for(const i of Object.values(userData.inpcs)){
    if(i.campaignId===campaignId) delete userData.inpcs[i.id];
  }
  for(const cond of Object.values(userData.conditions)){
    if(cond.campaignId===campaignId) delete userData.conditions[cond.id];
  }

  delete userData.campaigns[campaignId];

  scheduleSave();
  broadcast("campaigns:changed", { campaignId });
  res.json({ ok:true });
});


/* Players (campaign) */
app.get("/api/campaigns/:campaignId/players", (req,res)=>{
  const { campaignId } = req.params;
  res.json(Object.values(userData.players).filter(p=>p.campaignId===campaignId));
});

/* iNPCs (campaign) */
app.get("/api/campaigns/:campaignId/inpcs", (req,res)=>{
  const { campaignId } = req.params;
  res.json(Object.values(userData.inpcs).filter(i=>i.campaignId===campaignId));
});

app.post("/api/campaigns/:campaignId/inpcs", (req,res)=>{
  const { campaignId } = req.params;
  const b = req.body ?? {};
  const monsterId = String(b.monsterId ?? "").trim();
  const qty = Math.min(Math.max(Number(b.qty ?? 1), 1), 20);

  const m = compendiumState.monsters.find(x => x.id === monsterId);
  if(!m) return res.status(404).json({ ok:false, message:"Monster not found in compendium" });

  const defaultAc = m?.ac ?? null;
  const defaultHp = (m?.hp?.average ?? m?.hp) ?? null;
  const defaultAcDetail = (m?.ac?.note ?? m?.ac?.type ?? null);
  const defaultHpDetail = (m?.hp?.formula ?? m?.hp?.roll ?? null);

  const t = now();
  const created = [];

  for(let i=0;i<qty;i++){
    const id = uid();
    const name = String(b.name ?? "").trim() || m.name;
    const hpMax = (b.hpMax != null && Number.isFinite(Number(b.hpMax))) ? Number(b.hpMax) : (defaultHp != null ? Number(defaultHp) : 1);
    const ac = (b.ac != null && Number.isFinite(Number(b.ac))) ? Number(b.ac) : (defaultAc != null ? Number(defaultAc) : 10);
    userData.inpcs[id] = {
      id,
      campaignId,
      monsterId,
      name,
      label: b.label != null ? String(b.label).trim() : null,
      friendly: b.friendly != null ? Boolean(b.friendly) : true,
      hpMax,
      hpCurrent: b.hpCurrent != null ? Number(b.hpCurrent) : hpMax,
      hpDetails: b.hpDetails != null ? String(b.hpDetails) : (defaultHpDetail != null ? String(defaultHpDetail) : null),
      ac,
      acDetails: b.acDetails != null ? String(b.acDetails) : (defaultAcDetail != null ? String(defaultAcDetail) : null),
      createdAt: t,
      updatedAt: t
    };
    created.push(userData.inpcs[id]);
  }

  scheduleSave();
  broadcast("inpcs:changed", { campaignId });
  res.json(created.length === 1 ? created[0] : { ok:true, created });
});

app.put("/api/inpcs/:inpcId", (req,res)=>{
  const { inpcId } = req.params;
  const existing = userData.inpcs[inpcId];
  if(!existing) return res.status(404).json({ ok:false, message:"Not found" });
  const b = req.body ?? {};
  const t = now();
  userData.inpcs[inpcId] = {
    ...existing,
    name: b.name != null ? String(b.name).trim() : existing.name,
    label: b.label != null ? String(b.label).trim() : existing.label,
    friendly: b.friendly != null ? Boolean(b.friendly) : existing.friendly,
    hpMax: b.hpMax != null ? Number(b.hpMax) : existing.hpMax,
    hpCurrent: b.hpCurrent != null ? Number(b.hpCurrent) : existing.hpCurrent,
    hpDetails: b.hpDetails != null ? (b.hpDetails === null ? null : String(b.hpDetails)) : existing.hpDetails,
    ac: b.ac != null ? Number(b.ac) : existing.ac,
    acDetails: b.acDetails != null ? (b.acDetails === null ? null : String(b.acDetails)) : existing.acDetails,
    updatedAt: t
  };
  scheduleSave();
  broadcast("inpcs:changed", { campaignId: existing.campaignId });
  res.json(userData.inpcs[inpcId]);
});

app.delete("/api/inpcs/:inpcId", (req,res)=>{
  const { inpcId } = req.params;
  const existing = userData.inpcs[inpcId];
  if(!existing) return res.status(404).json({ ok:false, message:"Not found" });
  // Also remove any combatants that reference this iNPC.
  for(const combat of Object.values(userData.combats)){
    combat.combatants = (combat.combatants ?? []).filter(c => !(c.baseType === "inpc" && c.baseId === inpcId));
  }
  delete userData.inpcs[inpcId];
  scheduleSave();
  broadcast("inpcs:changed", { campaignId: existing.campaignId });
  res.json({ ok:true });
});

app.post("/api/campaigns/:campaignId/players", (req,res)=>{
  const { campaignId } = req.params;
  const p = req.body ?? {};
  const id = uid();
  const t = now();
  userData.players[id] = {
    id, campaignId,
    playerName: String(p.playerName ?? "").trim() || "Player",
    characterName: String(p.characterName ?? "").trim() || "Character",
    level: Number(p.level ?? 1),
    class: String(p.class ?? "").trim() || "Class",
    species: String(p.species ?? "").trim() || "Species",
    hpMax: Number(p.hpMax ?? 10),
    hpCurrent: Number(p.hpCurrent ?? p.hpMax ?? 10),
    ac: Number(p.ac ?? 10),
    // Ability scores
    str: Number(p.str ?? 10),
    dex: Number(p.dex ?? 10),
    con: Number(p.con ?? 10),
    int: Number(p.int ?? 10),
    wis: Number(p.wis ?? 10),
    cha: Number(p.cha ?? 10),
    color: p.color ?? "green",
    createdAt:t, updatedAt:t
  };
  scheduleSave();
  broadcast("players:changed", { campaignId });
  res.json(userData.players[id]);
});

app.put("/api/players/:playerId", (req,res)=>{
  const { playerId } = req.params;
  const existing = userData.players[playerId];
  if(!existing) return res.status(404).json({ ok:false, message:"Not found" });
  const p = req.body ?? {};
  const t = now();
  userData.players[playerId] = {
    ...existing,
    playerName: p.playerName != null ? String(p.playerName).trim() : existing.playerName,
    characterName: p.characterName != null ? String(p.characterName).trim() : existing.characterName,
    level: p.level != null ? Number(p.level) : existing.level,
    class: p.class != null ? String(p.class).trim() : existing.class,
    species: p.species != null ? String(p.species).trim() : existing.species,
    hpMax: p.hpMax != null ? Number(p.hpMax) : existing.hpMax,
    hpCurrent: p.hpCurrent != null ? Number(p.hpCurrent) : existing.hpCurrent,
    ac: p.ac != null ? Number(p.ac) : existing.ac,
    // Ability scores
    str: p.str != null ? Number(p.str) : (existing.str ?? 10),
    dex: p.dex != null ? Number(p.dex) : (existing.dex ?? 10),
    con: p.con != null ? Number(p.con) : (existing.con ?? 10),
    int: p.int != null ? Number(p.int) : (existing.int ?? 10),
    wis: p.wis != null ? Number(p.wis) : (existing.wis ?? 10),
    cha: p.cha != null ? Number(p.cha) : (existing.cha ?? 10),
    updatedAt: t
  };
  scheduleSave();
  broadcast("players:changed", { campaignId: existing.campaignId });
  res.json(userData.players[playerId]);
});

app.delete("/api/players/:playerId", (req,res)=>{
  const { playerId } = req.params;
  const existing = userData.players[playerId];
  if(!existing) return res.status(404).json({ ok:false, message:"Not found" });

  // Remove this player's combatants from any encounter rosters to avoid orphan rows.
  for (const [encounterId, combat] of Object.entries(userData.combats)) {
    if (!combat?.combatants) continue;
    const before = combat.combatants.length;
    const next = combat.combatants.filter((c) => !(c?.sourceType === "player" && c?.sourceId === playerId));
    if (next.length !== before) {
      userData.combats[encounterId] = { ...combat, combatants: next, updatedAt: now() };
      broadcast("encounter:combatantsChanged", { encounterId });
    }
  }

  delete userData.players[playerId];
  scheduleSave();
  broadcast("players:changed", { campaignId: existing.campaignId });
  res.json({ ok:true });
});

/* Adventures (campaign) */
app.get("/api/campaigns/:campaignId/adventures", (req,res)=>{
  const { campaignId } = req.params;
  const rows = Object.values(userData.adventures)
    .filter(a=>a.campaignId===campaignId)
    .sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.post("/api/campaigns/:campaignId/adventures", (req,res)=>{
  const { campaignId } = req.params;
  const name = (req.body?.name ?? "").toString().trim() || "New Adventure";
  const id = uid();
  const t = now();
  userData.adventures[id] = { id, campaignId, name, status:"active", sort: nextSort(Object.values(userData.adventures).filter(a=>a.campaignId===campaignId)), createdAt:t, updatedAt:t };
  scheduleSave();
  broadcast("adventures:changed", { campaignId });
  res.json(userData.adventures[id]);
});

app.put("/api/adventures/:adventureId", (req,res)=>{
  const { adventureId } = req.params;
  const a = userData.adventures[adventureId];
  if(!a) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const name = (req.body?.name ?? "").toString().trim() || a.name;
  const t = now();
  userData.adventures[adventureId] = { ...a, name, updatedAt: t };
  scheduleSave();
  broadcast("adventures:changed", { adventureId });
  res.json(userData.adventures[adventureId]);
});

app.delete("/api/adventures/:adventureId", (req,res)=>{
  const { adventureId } = req.params;
  const a = userData.adventures[adventureId];
  if(!a) return res.status(404).json({ ok:false, message:"Adventure not found" });

  // delete encounters under this adventure
  const encIds = Object.values(userData.encounters).filter(e=>e.adventureId===adventureId).map(e=>e.id);
  for(const id of encIds){
    delete userData.encounters[id];
    delete userData.combats[id];
  }

  // delete adventure notes
  for(const n of Object.values(userData.notes)){
    if(n.adventureId===adventureId) delete userData.notes[n.id];
  }

  delete userData.adventures[adventureId];

  scheduleSave();
  broadcast("adventures:changed", { adventureId });
  res.json({ ok:true });
});


/* Encounters */
app.get("/api/adventures/:adventureId/encounters", (req,res)=>{
  const { adventureId } = req.params;
  const rows = Object.values(userData.encounters)
    .filter(e=>e.adventureId===adventureId)
    .sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.post("/api/adventures/:adventureId/encounters", (req,res)=>{
  const { adventureId } = req.params;
  const adv = userData.adventures[adventureId];
  if(!adv) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const name = (req.body?.name ?? "").toString().trim() || "New Encounter";
  const id = uid();
  const t = now();
  userData.encounters[id] = { id, campaignId: adv.campaignId, adventureId, name, status:"Open", createdAt:t, updatedAt:t };
  ensureCombat(id);
  scheduleSave();
  broadcast("encounters:changed", { campaignId: adv.campaignId, adventureId });
  res.json(userData.encounters[id]);
});

/* Loose encounters (campaign, no adventure) */
app.get("/api/campaigns/:campaignId/encounters", (req,res)=>{
  const { campaignId } = req.params;
  const rows = Object.values(userData.encounters)
    .filter(e=>e.campaignId===campaignId && !e.adventureId)
    .sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.post("/api/campaigns/:campaignId/encounters", (req,res)=>{
  const { campaignId } = req.params;
  const name = (req.body?.name ?? "").toString().trim() || "Loose Encounter";
  const id = uid();
  const t = now();
  userData.encounters[id] = { id, campaignId, adventureId:null, name, status:"Open", createdAt:t, updatedAt:t };
  ensureCombat(id);
  scheduleSave();
  broadcast("encounters:changed", { campaignId, adventureId:null });
  res.json(userData.encounters[id]);
});

app.put("/api/encounters/:encounterId", (req,res)=>{
  const { encounterId } = req.params;
  const e = userData.encounters[encounterId];
  if(!e) return res.status(404).json({ ok:false, message:"Encounter not found" });
  const name = (req.body?.name ?? "").toString().trim() || e.name;
  const status = (req.body?.status ?? e.status).toString();
  const t = now();
  userData.encounters[encounterId] = { ...e, name, status, updatedAt: t };
  scheduleSave();
  broadcast("encounters:changed", { encounterId });
  res.json(userData.encounters[encounterId]);
});

app.delete("/api/encounters/:encounterId", (req,res)=>{
  const { encounterId } = req.params;
  const e = userData.encounters[encounterId];
  if(!e) return res.status(404).json({ ok:false, message:"Encounter not found" });

  delete userData.encounters[encounterId];
  delete userData.combats[encounterId];

  scheduleSave();
  broadcast("encounters:changed", { encounterId });
  res.json({ ok:true });
});


app.put("/api/encounters/:encounterId", (req,res)=>{
  const { encounterId } = req.params;
  const existing = userData.encounters[encounterId];
  if(!existing) return res.status(404).json({ ok:false, message:"Not found" });
  const t = now();
  userData.encounters[encounterId] = {
    ...existing,
    name: req.body?.name != null ? String(req.body.name).trim() : existing.name,
    status: req.body?.status != null ? String(req.body.status) : existing.status,
    updatedAt: t
  };
  scheduleSave();
  broadcast("encounters:changed", { campaignId: existing.campaignId, adventureId: existing.adventureId ?? null });
  res.json(userData.encounters[encounterId]);
});

/* Notes (campaign/adventure) */
app.get("/api/campaigns/:campaignId/notes", (req,res)=>{
  const { campaignId } = req.params;
  const rows = Object.values(userData.notes)
    .filter(n=>n.campaignId===campaignId && !n.adventureId)
    .sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.get("/api/adventures/:adventureId/notes", (req,res)=>{
  const { adventureId } = req.params;
  const rows = Object.values(userData.notes)
    .filter(n=>n.adventureId===adventureId)
    .sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.post("/api/campaigns/:campaignId/notes", (req,res)=>{
  const { campaignId } = req.params;
  const title = (req.body?.title ?? "").toString().trim() || "Note";
  const text = (req.body?.text ?? "").toString();
  const id = uid();
  const t = now();
  userData.notes[id] = { id, campaignId, adventureId:null, title, text, sort: nextSort(Object.values(userData.notes).filter(n=>n.campaignId===campaignId && n.adventureId==null)), createdAt:t, updatedAt:t };
  scheduleSave();
  broadcast("notes:changed", { campaignId, adventureId:null });
  res.json(userData.notes[id]);
});

app.post("/api/adventures/:adventureId/notes", (req,res)=>{
  const { adventureId } = req.params;
  const adv = userData.adventures[adventureId];
  if(!adv) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const title = (req.body?.title ?? "").toString().trim() || "Note";
  const text = (req.body?.text ?? "").toString();
  const id = uid();
  const t = now();
  userData.notes[id] = { id, campaignId: adv.campaignId, adventureId, title, text, createdAt:t, updatedAt:t };
  scheduleSave();
  broadcast("notes:changed", { campaignId: adv.campaignId, adventureId });
  res.json(userData.notes[id]);
});

app.put("/api/notes/:noteId", (req,res)=>{
  const { noteId } = req.params;
  const n = userData.notes[noteId];
  if(!n) return res.status(404).json({ ok:false, message:"Note not found" });
  const title = (req.body?.title ?? "").toString().trim() || n.title;
  const text = (req.body?.text ?? "").toString();
  const t = now();
  userData.notes[noteId] = { ...n, title, text, updatedAt: t };
  scheduleSave();
  broadcast("notes:changed", { noteId });
  res.json(userData.notes[noteId]);
});

app.delete("/api/notes/:noteId", (req,res)=>{
  const { noteId } = req.params;
  const n = userData.notes[noteId];
  if(!n) return res.status(404).json({ ok:false, message:"Note not found" });
  delete userData.notes[noteId];
  scheduleSave();
  broadcast("notes:changed", { noteId });
  res.json({ ok:true });
});


/* Encounter combatants */
app.get("/api/encounters/:encounterId/combatants", (req,res)=>{
  const { encounterId } = req.params;
  const combat = ensureCombat(encounterId);

  // Players are NOT instanced: serve player-backed state for player combatants.
  const merged = combat.combatants.map((c)=>{
    if(c.baseType !== "player") return c;
    const p = userData.players[c.baseId];
    if(!p) return c;
    return {
      ...c,
      name: p.characterName,
      playerName: p.playerName,
      label: c.label ?? p.characterName,
      hpCurrent: p.hpCurrent,
      hpMax: p.hpMax,
      ac: p.ac,
      overrides: p.overrides ?? c.overrides,
      conditions: Array.isArray(p.conditions) ? p.conditions : (c.conditions ?? []),
    };
  });

  res.json(merged);
});

// Persisted combat state (round + active combatant)
app.get("/api/encounters/:encounterId/combatState", (req,res)=>{
  const { encounterId } = req.params;
  const combat = ensureCombat(encounterId);
  res.json({
    round: Number(combat.round ?? 1) || 1,
    activeCombatantId: combat.activeCombatantId ?? null
  });
});

app.put("/api/encounters/:encounterId/combatState", (req,res)=>{
  const { encounterId } = req.params;
  const combat = ensureCombat(encounterId);
  const round = Number(req.body?.round);
  const activeCombatantId = req.body?.activeCombatantId != null ? String(req.body.activeCombatantId) : null;

  if(Number.isFinite(round) && round >= 1) combat.round = round;
  combat.activeCombatantId = activeCombatantId;

  // Maintain activeIndex for backwards compatibility/debugging.
  if(activeCombatantId){
    const idx = combat.combatants.findIndex(c=>c.id===activeCombatantId);
    if(idx >= 0) combat.activeIndex = idx;
  }

  combat.updatedAt = now();
  scheduleSave();
  broadcast("encounter:combatStateChanged", { encounterId });
  res.json({ ok:true, round: combat.round, activeCombatantId: combat.activeCombatantId });
});

app.post("/api/encounters/:encounterId/combatants/addPlayers", (req,res)=>{
  const { encounterId } = req.params;
  const encounter = userData.encounters[encounterId];
  if(!encounter) return res.status(404).json({ ok:false, message:"Encounter not found" });
  const combat = ensureCombat(encounterId);
  const existingPlayerIds = new Set(combat.combatants.filter(c=>c.baseType==="player").map(c=>c.baseId));
  const players = Object.values(userData.players).filter(p=>p.campaignId===encounter.campaignId);
  const t = now();
  let added = 0;
  for(const p of players){
    if(existingPlayerIds.has(p.id)) continue;
    combat.combatants.push({
      id: uid(),
      encounterId,
      baseType: "player",
      baseId: p.id,
      name: p.characterName,
      label: p.characterName,
      initiative: null,
      friendly: true,
      color: "green",
      overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      hpCurrent: p.hpCurrent,
      hpMax: p.hpMax,
      hpDetail: null,
      ac: p.ac,
      acDetail: null,
      conditions: [],
      createdAt: t,
      updatedAt: t
    });
    added++;
  }
  combat.updatedAt = t;
  scheduleSave();
  broadcast("encounter:combatantsChanged", { encounterId });
  res.json({ ok:true, added });
});

app.post("/api/encounters/:encounterId/combatants/addMonster", (req,res)=>{
  const { encounterId } = req.params;
  const encounter = userData.encounters[encounterId];
  if(!encounter) return res.status(404).json({ ok:false, message:"Encounter not found" });

  const monsterId = String(req.body?.monsterId ?? "");
  const qty = Math.min(Math.max(Number(req.body?.qty ?? 1), 1), 20);
  const friendly = Boolean(req.body?.friendly ?? false);

  const labelBaseRaw = req.body?.labelBase;
  const labelBase = labelBaseRaw != null ? String(labelBaseRaw).trim() : "";
  const acOverrideRaw = req.body?.ac != null ? Number(req.body.ac) : NaN;
  const acOverride = Number.isFinite(acOverrideRaw) ? acOverrideRaw : null;
  const acDetail = req.body?.acDetail != null ? String(req.body.acDetail) : null;
  const hpMaxOverrideRaw = req.body?.hpMax != null ? Number(req.body.hpMax) : NaN;
  const hpMaxOverride = Number.isFinite(hpMaxOverrideRaw) ? hpMaxOverrideRaw : null;
  const hpDetail = req.body?.hpDetail != null ? String(req.body.hpDetail) : null;
  const attackOverrides = req.body?.attackOverrides && typeof req.body.attackOverrides === "object" ? req.body.attackOverrides : null;

  const m = compendiumState.monsters.find(x => x.id === monsterId);
  if(!m) return res.status(404).json({ ok:false, message:"Monster not found in compendium" });

  const r = m;
  // Compendium values vary across sources/versions. Be defensive.
  const leadingNumber = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const m = v.match(/\d+/);
      return m ? Number(m[0]) : null;
    }
    if (typeof v === "object") {
      // common shapes: { value, note }, { ac, note }, etc.
      const candidates = [v.value, v.ac, v.armorClass, v.average, v.hp, v.max];
      for (const c of candidates) {
        const n = leadingNumber(c);
        if (n != null) return n;
      }
    }
    return null;
  };

  const defaultAc = leadingNumber(r?.ac);
  const defaultHp = leadingNumber(r?.hp?.average ?? r?.hp);
  const defaultAcDetail = (r?.ac?.note ?? r?.ac?.type ?? null);
  const defaultHpDetail = (r?.hp?.formula ?? r?.hp?.roll ?? null);

  const combat = ensureCombat(encounterId);
  const t = now();

  const baseName = m.name;
  const effectiveLabelBase = labelBase || baseName;
  let n = nextLabelNumber(encounterId, effectiveLabelBase);

  const created = [];
  for(let i=0;i<qty;i++){
    const label = qty === 1 ? effectiveLabelBase : `${effectiveLabelBase} ${n++}`;
    const hpMax = (hpMaxOverride != null && Number.isFinite(hpMaxOverride)) ? hpMaxOverride : (defaultHp != null ? defaultHp : null);
    const ac = (acOverride != null && Number.isFinite(acOverride)) ? acOverride : (defaultAc != null ? defaultAc : null);

    const c = {
      id: uid(),
      encounterId,
      baseType: "monster",
      baseId: monsterId,
      name: baseName,
      label,
      initiative: null,
      friendly,
      color: friendly ? "lightgreen" : "red",
      overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      hpCurrent: hpMax,
      hpMax,
      hpDetail: hpDetail != null ? hpDetail : (defaultHpDetail != null ? String(defaultHpDetail) : null),
      ac,
      acDetail: acDetail != null ? acDetail : (defaultAcDetail != null ? String(defaultAcDetail) : null),
      attackOverrides: attackOverrides ?? null,
      conditions: [],
      createdAt: t,
      updatedAt: t
    };
    combat.combatants.push(c);
    created.push(c);
  }

  combat.updatedAt = t;
  scheduleSave();
  broadcast("encounter:combatantsChanged", { encounterId });
  res.json({ ok:true, created });
});

app.post("/api/encounters/:encounterId/combatants/addInpc", (req,res)=>{
  const { encounterId } = req.params;
  const encounter = userData.encounters[encounterId];
  if(!encounter) return res.status(404).json({ ok:false, message:"Encounter not found" });

  const inpcId = String(req.body?.inpcId ?? "").trim();
  const i = userData.inpcs[inpcId];
  if(!i) return res.status(404).json({ ok:false, message:"iNPC not found" });

  const combat = ensureCombat(encounterId);
  const t = now();

  const c = {
    id: uid(),
    encounterId,
    baseType: "inpc",
    baseId: inpcId,
    name: i.name,
    label: i.label || i.name,
    initiative: null,
    friendly: Boolean(i.friendly),
    color: Boolean(i.friendly) ? "lightgreen" : "red",
    overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
    hpCurrent: Number(i.hpCurrent ?? i.hpMax ?? 1),
    hpMax: Number(i.hpMax ?? 1),
    hpDetail: i.hpDetails ?? null,
    ac: Number(i.ac ?? 10),
    acDetail: i.acDetails ?? null,
    attackOverrides: null,
    conditions: [],
    createdAt: t,
    updatedAt: t
  };

  combat.combatants.push(c);
  combat.updatedAt = t;
  scheduleSave();
  broadcast("encounter:combatantsChanged", { encounterId });
  res.json({ ok:true, created: c });
});

app.put("/api/encounters/:encounterId/combatants/:combatantId", (req,res)=>{
  const { encounterId, combatantId } = req.params;
  const combat = ensureCombat(encounterId);
  const idx = combat.combatants.findIndex(c=>c.id===combatantId);
  if(idx<0) return res.status(404).json({ ok:false, message:"Not found" });
  const existing = combat.combatants[idx];
  const t = now();
  const next = {
    ...existing,
    label: req.body?.label != null ? String(req.body.label) : existing.label,
    initiative: req.body?.initiative !== undefined ? (req.body.initiative == null ? null : Number(req.body.initiative)) : (existing.initiative ?? null),
    friendly: req.body?.friendly != null ? Boolean(req.body.friendly) : existing.friendly,
    color: req.body?.color != null ? String(req.body.color) : existing.color,
    hpCurrent: req.body?.hpCurrent != null ? Number(req.body.hpCurrent) : existing.hpCurrent,
    hpMax: req.body?.hpMax != null ? Number(req.body.hpMax) : existing.hpMax,
    hpDetail: req.body?.hpDetail != null ? String(req.body.hpDetail) : existing.hpDetail,
    ac: req.body?.ac != null ? Number(req.body.ac) : existing.ac,
    acDetail: req.body?.acDetail != null ? String(req.body.acDetail) : existing.acDetail,
    overrides: req.body?.overrides != null ? req.body.overrides : existing.overrides,
    conditions: Array.isArray(req.body?.conditions) ? req.body.conditions : (existing.conditions ?? []),
    updatedAt: t
  };
  combat.combatants[idx] = next;

  // Players are NOT instanced: persist player combat state across encounters.
  if(next.baseType === "player"){
    const p = userData.players[next.baseId];
    if(p){
      if(next.hpCurrent != null) p.hpCurrent = Number(next.hpCurrent);
      // Do not overwrite base hpMax/ac here; use overrides for temporary changes.
      p.overrides = next.overrides ?? p.overrides ?? null;
      p.conditions = Array.isArray(next.conditions) ? next.conditions : (p.conditions ?? []);
      p.updatedAt = t;
      broadcast("players:changed", { campaignId: p.campaignId });
    }
  }

  combat.updatedAt = t;
  scheduleSave();
  broadcast("encounter:combatantsChanged", { encounterId });
  res.json(next);
});

// Remove a single combatant from the encounter roster
app.delete("/api/encounters/:encounterId/combatants/:combatantId", (req, res) => {
  const { encounterId, combatantId } = req.params;

  // Combatants live under userData.combats (see ensureCombat). Deleting from encounters
  // would be a no-op for monsters added via the compendium.
  const combat = ensureCombat(encounterId);
  const idx = combat.combatants.findIndex((x) => x.id === combatantId);
  if (idx < 0) return res.status(404).json({ error: "Combatant not found" });

  combat.combatants.splice(idx, 1);
  combat.updatedAt = now();
  scheduleSave();
  broadcast("encounter:combatantsChanged", { encounterId });
  res.json({ ok: true });
});



/* Reorder (drag & drop) */
app.post("/api/campaigns/:campaignId/adventures/reorder", (req,res)=>{
  const { campaignId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  ids.forEach((id, i)=>{
    const a = userData.adventures[id];
    if(a && a.campaignId===campaignId){ a.sort = i+1; a.updatedAt = now(); }
  });
  scheduleSave();
  broadcast("adventures:changed", { campaignId });
  res.json({ ok:true });
});

app.post("/api/campaigns/:campaignId/encounters/reorderLoose", (req,res)=>{
  const { campaignId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  ids.forEach((id, i)=>{
    const e = userData.encounters[id];
    if(e && e.campaignId===campaignId && e.adventureId==null){ e.sort = i+1; e.updatedAt = now(); }
  });
  scheduleSave();
  broadcast("encounters:changed", { campaignId });
  res.json({ ok:true });
});

app.post("/api/adventures/:adventureId/encounters/reorder", (req,res)=>{
  const { adventureId } = req.params;
  const a = userData.adventures[adventureId];
  if(!a) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  ids.forEach((id, i)=>{
    const e = userData.encounters[id];
    if(e && e.adventureId===adventureId){ e.sort = i+1; e.updatedAt = now(); }
  });
  scheduleSave();
  broadcast("encounters:changed", { campaignId: a.campaignId });
  res.json({ ok:true });
});

app.post("/api/campaigns/:campaignId/notes/reorder", (req,res)=>{
  const { campaignId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  ids.forEach((id, i)=>{
    const n = userData.notes[id];
    if(n && n.campaignId===campaignId && n.adventureId==null){ n.sort = i+1; n.updatedAt = now(); }
  });
  scheduleSave();
  broadcast("notes:changed", { campaignId });
  res.json({ ok:true });
});

app.post("/api/adventures/:adventureId/notes/reorder", (req,res)=>{
  const { adventureId } = req.params;
  const a = userData.adventures[adventureId];
  if(!a) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  ids.forEach((id, i)=>{
    const n = userData.notes[id];
    if(n && n.adventureId===adventureId){ n.sort = i+1; n.updatedAt = now(); }
  });
  scheduleSave();
  broadcast("notes:changed", { campaignId: a.campaignId });
  res.json({ ok:true });
});

/* Treasure */
app.get("/api/campaigns/:campaignId/treasure", (req,res)=>{
  const { campaignId } = req.params;
  const c = userData.campaigns[campaignId];
  if(!c) return res.status(404).json({ ok:false, message:"Campaign not found" });
  const rows = Object.values(userData.treasure ?? {}).filter((t)=>t?.campaignId===campaignId && (t?.adventureId==null || t?.adventureId==="")).sort(bySortThenUpdatedDesc);
  res.json(rows);
});

app.get("/api/adventures/:adventureId/treasure", (req,res)=>{
  const { adventureId } = req.params;
  const a = userData.adventures[adventureId];
  if(!a) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const rows = Object.values(userData.treasure ?? {}).filter((t)=>t?.adventureId===adventureId).sort(bySortThenUpdatedDesc);
  res.json(rows);
});

function createTreasureEntry({ campaignId, adventureId, source, itemId, custom }){
  const id = uid();
  const t = now();

  let name = "New Item";
  let rarity = null;
  let type = null;
  let typeKey = null;
  let attunement = false;
  let text = "";

  if(source === "compendium"){
    const it = compendiumState.items.find((x)=>String(x.id)===String(itemId));
    if(!it) return { error: { status: 404, message: "Item not found in compendium" } };
    name = it.name;
    rarity = it.rarity ?? null;
    type = it.type ?? null;
    typeKey = it.typeKey ?? null;
    attunement = Boolean(it.attunement);
    text = it.text ?? "";
  } else {
    const c = custom ?? {};
    name = String(c.name ?? "New Item").trim() || "New Item";
    rarity = c.rarity != null ? String(c.rarity).trim() : null;
    type = c.type != null ? String(c.type).trim() : null;
    typeKey = type ? normalizeKey(type) : null;
    attunement = Boolean(c.attunement);
    text = c.text != null ? String(c.text) : "";
  }

  const existing = Object.values(userData.treasure ?? {}).filter((x)=>x?.campaignId===campaignId && String(x?.adventureId ?? "")===String(adventureId ?? ""));
  const sort = nextSort(existing);

  const entry = {
    id,
    campaignId,
    adventureId: adventureId ?? null,
    source,
    itemId: itemId ?? null,
    name,
    rarity,
    type,
    type_key: typeKey,
    attunement,
    text,
    sort,
    createdAt: t,
    updatedAt: t
  };

  userData.treasure[id] = entry;
  return { entry };
}

app.post("/api/campaigns/:campaignId/treasure", (req,res)=>{
  const { campaignId } = req.params;
  const c = userData.campaigns[campaignId];
  if(!c) return res.status(404).json({ ok:false, message:"Campaign not found" });
  const source = (req.body?.source ?? "compendium").toString();
  const itemId = req.body?.itemId ?? null;
  const custom = req.body?.custom ?? null;
  const out = createTreasureEntry({ campaignId, adventureId: null, source, itemId, custom });
  if(out.error) return res.status(out.error.status).json({ ok:false, message: out.error.message });
  scheduleSave();
  broadcast("treasure:changed", { campaignId });
  res.json(out.entry);
});

app.post("/api/adventures/:adventureId/treasure", (req,res)=>{
  const { adventureId } = req.params;
  const a = userData.adventures[adventureId];
  if(!a) return res.status(404).json({ ok:false, message:"Adventure not found" });
  const source = (req.body?.source ?? "compendium").toString();
  const itemId = req.body?.itemId ?? null;
  const custom = req.body?.custom ?? null;
  const out = createTreasureEntry({ campaignId: a.campaignId, adventureId, source, itemId, custom });
  if(out.error) return res.status(out.error.status).json({ ok:false, message: out.error.message });
  scheduleSave();
  broadcast("treasure:changed", { campaignId: a.campaignId });
  res.json(out.entry);
});

app.delete("/api/treasure/:treasureId", (req,res)=>{
  const { treasureId } = req.params;
  const t = userData.treasure?.[treasureId];
  if(!t) return res.status(404).json({ ok:false, message:"Treasure not found" });
  const campaignId = t.campaignId;
  delete userData.treasure[treasureId];
  scheduleSave();
  broadcast("treasure:changed", { campaignId });
  res.json({ ok:true });
});

/* Compendium */
app.get("/api/compendium/search", (req,res)=>{
  const q = req.query.q ?? "";
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"),10) || 50, 1), 200);
  const filters = {
    crMin: req.query.crMin != null ? Number(req.query.crMin) : null,
    crMax: req.query.crMax != null ? Number(req.query.crMax) : null,
    types: req.query.types ? String(req.query.types).split(",").filter(Boolean) : null,
    sizes: req.query.sizes ? String(req.query.sizes).split(",").filter(Boolean) : null,
    environments: req.query.env ? String(req.query.env).split(",").filter(Boolean) : null
  };
  res.json(searchCompendium(String(q), filters, limit));
});



app.get("/api/spells/search", (req,res)=>{
  const qRaw = String(req.query.q ?? "").trim();
  const q = qRaw.toLowerCase();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"),10) || 50, 1), 500);
  const levelRaw = String(req.query.level ?? "").trim();
  const level = levelRaw === "" ? null : (Number(levelRaw));

  const out = [];
  for(const s of compendiumState.spells){
    if (level != null && Number.isFinite(level)) {
      if (Number(s?.level ?? -999) !== level) continue;
    }

    if(q){
      const hay = `${s.name} ${s.baseName ?? ""}`.toLowerCase();
      const keyHay = `${s.nameKey ?? ""} ${s.baseKey ?? ""}`;
      if(!hay.includes(q) && !String(keyHay).includes(q)) continue;
    }

    out.push({ id: s.id, name: s.name, level: s.level, school: s.school, time: s.time });
  }

  // Stable ordering for predictable scrolling / filtering.
  out.sort((a,b)=> String(a.name).localeCompare(String(b.name)));
  res.json(out.slice(0, limit));
});

app.get("/api/spells/:spellId", (req,res)=>{
  const { spellId } = req.params;
  const s = compendiumState.spells.find(x=>x.id===spellId);
  if(!s) return res.status(404).json({ ok:false, message:"Spell not found in compendium" });
  res.json(s);
});

app.delete("/api/compendium", (_req,res)=>{
  try{ if(fs.existsSync(COMPENDIUM_PATH)) fs.unlinkSync(COMPENDIUM_PATH); }catch{}
  compendiumState.monsters = [];
  compendiumState.spells = [];
  compendiumState.items = [];
  compendiumState.loaded = false;
  broadcast("compendium:changed", { cleared:true });
  res.json({ ok:true });
});

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/api/compendium/import/xml", upload.single("file"), (req,res)=>{
  if(!req.file) return res.status(400).json({ ok:false, message:"No file uploaded" });

  const xml = req.file.buffer.toString("utf-8");
  const parser = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:"@_", trimValues:true });
  const parsed = parser.parse(xml);
  const comp = parsed?.compendium ?? parsed;
  const monsters = asArray(comp?.monster);
  const spells = asArray(comp?.spell);
  const items = asArray(comp?.item);

  const incoming = [];
  for (const m of monsters){
    // Fight Club XML sometimes emits nested objects/arrays for fields; normalize to plain text.
    const name = (asText(m?.name) || "Unknown").trim();
    const nameKey = normalizeKey(name);
    const typeFull = m?.type != null ? String(m.type) : null;
    const typeKey = typeFull ? (String(typeFull).trim().match(/^([a-zA-Z]+)/)?.[1]?.toLowerCase() ?? null) : null;
    const cr = m?.cr != null ? parseCrValue(m.cr) : null;

    incoming.push({
      id: `m_${nameKey}`,
      name,
      name_key: nameKey,
      cr: Number.isFinite(cr) ? cr : null,
      type_full: typeFull,
      type_key: typeKey,
      size: m?.size ?? null,
      environment: m?.environment ?? null,
      source: null,
      ac: m?.ac ?? null,
      hp: normalizeHp(m?.hp ?? null),
      speed: m?.speed ?? null,
      str: m?.str ?? null,
      dex: m?.dex ?? null,
      con: m?.con ?? null,
      int: m?.int ?? null,
      wis: m?.wis ?? null,
      cha: m?.cha ?? null,

      save: m?.save ?? null,
      skill: m?.skill ?? null,
      senses: m?.senses ?? null,
      languages: m?.languages ?? null,
      immune: m?.immune ?? null,
      resist: m?.resist ?? null,
      vulnerable: m?.vulnerable ?? null,
      conditionImmune: m?.conditionImmune ?? null,

      trait: asArray(m?.trait),
      action: asArray(m?.action).map((a)=> {
        const name = a?.name ?? a?.title ?? null;
        const text = a?.text ?? a?.description ?? "";
        const attack = parseAttackFromText(text);
        return { ...a, name, text, attack };
      }),
      reaction: asArray(m?.reaction),
      legendary: asArray(m?.legendary),
      spellcasting: asArray(m?.spellcasting),
      spells: asArray(m?.spells)
    });

  }

  const incomingSpells = [];
  for (const s of spells){
  const displayName = (asText(s?.name) || "Unknown").trim();
  // Identity is based on the full display name so we don't collapse variants like "Aid" vs "Aid [2024]".
  const fullKey = normalizeKey(displayName);
  const normalizedName = displayName.replace(/\s*\[[^\]]+\]\s*$/,"").trim() || displayName;
  const baseKey = normalizeKey(normalizedName);
  const id = `s_${fullKey.replace(/\s/g,"_")}`;

  const level = s?.level != null ? Number(String(s.level).replace(/[^0-9]/g, "")) : null;
  const texts = asArray(s?.text).map((t)=> (t==null?"":String(t)).trim()).filter((t)=>t.length>0);

    incomingSpells.push({
    id,
    name: displayName,
    name_key: fullKey,
    base_key: baseKey,
    level: Number.isFinite(level) ? level : null,
    school: s?.school ?? null,
    time: s?.time ?? null,
    range: s?.range ?? null,
    components: s?.components ?? null,
    duration: s?.duration ?? null,
    classes: s?.classes ?? null,
    text: texts
    });
  }

  function parseItemDetail(detailRaw){
    const detail = String(detailRaw ?? "").trim();
    const lower = detail.toLowerCase();
    const rarityList = ["common","uncommon","rare","very rare","legendary","artifact"];
    let rarity = null;
    for (const r of rarityList){
      if (lower.startsWith(r)) { rarity = r; break; }
    }
    const attunement = /requires\s+attunement|attunement\s*\)/i.test(detail);
    return { rarity, attunement };
  }

  function mapItemType(codeRaw){
    const code = String(codeRaw ?? "").trim().toUpperCase();
    const map = {
      M: "Weapon",
      R: "Weapon",
      A: "Armor",
      S: "Shield",
      ST: "Staff",
      RD: "Rod",
      WD: "Wand",
      RG: "Ring",
      SC: "Scroll",
      P: "Potion",
      W: "Wondrous",
      G: "Gear"
    };
    const type = map[code] ?? (code ? "Other" : "Other");
    return { type, typeKey: normalizeKey(type) };
  }

  const incomingItems = [];
  for (const it of items){
    const name = String(it?.name ?? "Unknown").trim();
    const nameKey = normalizeKey(name);
    const id = `i_${nameKey.replace(/\s/g,"_")}`;
    const typeCode = it?.type ?? null;
    const typeMap = mapItemType(typeCode);
    const parsedDetail = parseItemDetail(it?.detail);
    const text = String(it?.text ?? "").trim();

    incomingItems.push({
      id,
      name,
      name_key: nameKey,
      rarity: parsedDetail.rarity,
      type: typeMap.type,
      type_key: typeMap.typeKey,
      attunement: parsedDetail.attunement,
      text
    });
  }

  const current = loadJson(COMPENDIUM_PATH, { version: 4, monsters: [], spells: [], items: [] });

  const mapMon = new Map((current.monsters ?? []).map((m) => [normalizeKey(m.name_key ?? m.nameKey ?? m.name), m]));
  for (const m of incoming) mapMon.set(m.name_key, m);

  const mapSp = new Map((current.spells ?? []).map((s) => [String(s.id ?? ""), s]));
  for (const s of incomingSpells) mapSp.set(String(s.id), s);

  const mapIt = new Map((current.items ?? []).map((it) => [String(it.id ?? ""), it]));
  for (const it of incomingItems) mapIt.set(String(it.id), it);

  const merged = { version: 4, monsters: Array.from(mapMon.values()), spells: Array.from(mapSp.values()), items: Array.from(mapIt.values()) };
  saveJsonAtomic(COMPENDIUM_PATH, merged);
  loadCompendium();

  broadcast("compendium:changed", { imported: incoming.length, total: merged.monsters.length });
  res.json({ ok:true, imported: incoming.length, total: merged.monsters.length });
});


/* Export / Import Campaign */
app.get("/api/campaigns/:campaignId/export", (req,res)=>{
  const { campaignId } = req.params;
  const c = userData.campaigns[campaignId];
  if(!c) return res.status(404).json({ ok:false, message:"Campaign not found" });

  const doc = loadJson(campaignFilePath(campaignId), null) ?? { version: 1, campaign: c };
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=campaign_${campaignId}.json`);
  res.send(JSON.stringify(doc, null, 2));
});

app.post("/api/campaigns/import", upload.single("file"), (req,res)=>{
  if(!req.file) return res.status(400).json({ ok:false, message:"No file uploaded" });
  let doc = null;
  try{
    doc = JSON.parse(req.file.buffer.toString("utf-8"));
  }catch{
    return res.status(400).json({ ok:false, message:"Invalid JSON" });
  }
  const campaign = doc?.campaign;
  if(!campaign?.id) return res.status(400).json({ ok:false, message:"Missing campaign.id" });

  const campaignId = String(campaign.id);
  userData.campaigns[campaignId] = campaign;

  // Remove existing objects for this campaign to avoid orphans.
  for(const [id,a] of Object.entries(userData.adventures)) if(a?.campaignId===campaignId) delete userData.adventures[id];
  for(const [id,e] of Object.entries(userData.encounters)) if(e?.campaignId===campaignId){ delete userData.encounters[id]; delete userData.combats[id]; }
  for(const [id,n] of Object.entries(userData.notes)) if(n?.campaignId===campaignId) delete userData.notes[id];
  for(const [id,t] of Object.entries(userData.treasure)) if(t?.campaignId===campaignId) delete userData.treasure[id];
  for(const [id,p] of Object.entries(userData.players)) if(p?.campaignId===campaignId) delete userData.players[id];
  for(const [id,i] of Object.entries(userData.inpcs)) if(i?.campaignId===campaignId) delete userData.inpcs[id];
  for(const [id,cnd] of Object.entries(userData.conditions)) if(cnd?.campaignId===campaignId) delete userData.conditions[id];

  const mergeMap = (target, incoming) => {
    for(const [k,v] of Object.entries(incoming ?? {})) target[k]=v;
  };

  mergeMap(userData.adventures, doc.adventures);
  mergeMap(userData.encounters, doc.encounters);
  mergeMap(userData.notes, doc.notes);
  mergeMap(userData.treasure, doc.treasure);
  mergeMap(userData.players, doc.players);
  mergeMap(userData.inpcs, doc.inpcs);
  mergeMap(userData.conditions, doc.conditions);
  mergeMap(userData.combats, doc.combats);

  seedDefaultConditions(campaignId);

  scheduleSave();
  broadcast("campaigns:changed", { campaignId });
  res.json({ ok:true, campaignId });
});

/* Legacy: export all data in one file (debug) */
app.get("/api/user/export", (_req,res)=>{
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=userData.json");
  res.send(JSON.stringify(userData, null, 2));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});

wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type:"hello", payload:{ ok:true, time: now() } }));
});
