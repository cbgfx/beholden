import { XMLParser } from "fast-xml-parser";
import { asArray, asText, normalizeKey, parseCrValue } from "../../lib/text.js";
import { parseAttackFromText } from "../../lib/attacks.js";
import { normalizeHp } from "./normalizeHp.js";
import { loadJson } from "../../lib/jsonFile.js";

export function importCompendiumXml({ xml, compendium }) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
  const parsed = parser.parse(xml);
  const comp = parsed?.compendium ?? parsed;
  const monsters = asArray(comp?.monster);
  const spells = asArray(comp?.spell);
  const items = asArray(comp?.item);

  const incomingMonsters: any[] = [];
  for (const m of monsters) {
    const name = (asText(m?.name) || "Unknown").trim();
    const nameKey = normalizeKey(name);
    const typeFull = m?.type != null ? String(m.type) : null;
    const typeKey = typeFull
      ? String(typeFull)
          .trim()
          .match(/^([a-zA-Z]+)/)?.[1]
          ?.toLowerCase() ?? null
      : null;
    const cr = m?.cr != null ? parseCrValue(m.cr) : null;

    incomingMonsters.push({
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
      action: asArray(m?.action).map((a) => {
        const name = a?.name ?? a?.title ?? null;
        const text = a?.text ?? a?.description ?? "";
        const attack = parseAttackFromText(text);
        return { ...a, name, text, attack };
      }),
      reaction: asArray(m?.reaction),
      legendary: asArray(m?.legendary),
      spellcasting: asArray(m?.spellcasting),
      spells: asArray(m?.spells),
    });
  }

  const incomingSpells: any[] = [];
  for (const s of spells) {
    const displayName = (asText(s?.name) || "Unknown").trim();
    const fullKey = normalizeKey(displayName);
    const normalizedName = displayName.replace(/\s*\[[^\]]+\]\s*$/, "").trim() || displayName;
    const baseKey = normalizeKey(normalizedName);
    const id = `s_${fullKey.replace(/\s/g, "_")}`;

    const level = s?.level != null ? Number(String(s.level).replace(/[^0-9]/g, "")) : null;
    const texts = asArray(s?.text)
      .map((t) => (t == null ? "" : String(t)).trim())
      .filter((t) => t.length > 0);

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
      text: texts,
    });
  }

  const incomingItems: any[] = items.map(xmlItemToJson).filter((x): x is any => Boolean(x));

  type CompendiumFile = { version: number; monsters: any[]; spells: any[]; items: any[] };

  const current = loadJson(compendium.path, { version: 4, monsters: [] as any[], spells: [] as any[], items: [] as any[] }) as CompendiumFile;

  const mapMon = new Map(
    (current.monsters ?? []).map((m) => [normalizeKey(m.name_key ?? m.nameKey ?? m.name), m])
  );
  for (const m of incomingMonsters) mapMon.set(m.name_key, m);

  const mapSp = new Map((current.spells ?? []).map((s) => [String(s.id ?? ""), s]));
  for (const s of incomingSpells) mapSp.set(String(s.id), s);

  const mapIt = new Map((current.items ?? []).map((it) => [String(it.id ?? ""), it]));
  for (const it of incomingItems) {
    if (!it) continue;
    mapIt.set(String(it.id), it);
  }

  const merged = {
    version: 4,
    monsters: Array.from(mapMon.values()),
    spells: Array.from(mapSp.values()),
    items: Array.from(mapIt.values()),
  };

  compendium.writeMerged(merged);

  return { imported: incomingMonsters.length, total: merged.monsters.length };
}

function xmlItemToJson(it) {
  const name = String(it?.name ?? "Unknown").trim();
  if (!name) return null;
  const nameKey = normalizeKey(name);
  const id = `i_${nameKey.replace(/\s/g, "_")}`;

  const typeCode = it?.type ?? null;
  const { type, typeKey } = mapItemType(typeCode);
  const { rarity, attunement } = parseItemDetail(it?.detail);
  const text = String(it?.text ?? "").trim();

  return {
    id,
    name,
    name_key: nameKey,
    rarity,
    type,
    type_key: typeKey,
    attunement,
    text,
  };
}

function parseItemDetail(detailRaw) {
  const detail = String(detailRaw ?? "").trim();
  const lower = detail.toLowerCase();
  const rarityList = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];
  let rarity: string | null = null;
  for (const r of rarityList) {
    if (lower.startsWith(r)) {
      rarity = r;
      break;
    }
  }
  const attunement = /requires\s+attunement|attunement\s*\)/i.test(detail);
  return { rarity, attunement };
}

function mapItemType(codeRaw) {
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
    G: "Gear",
  };
  const type = map[code] ?? (code ? "Other" : "Other");
  return { type, typeKey: normalizeKey(type) };
}