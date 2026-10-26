import { normalizeKey } from "../../lib/text.js";
import { type JsonRecord, record } from "./grandCompendium.helpers.js";

export function itemTypeKey(entry: JsonRecord): string {
  return normalizeKey(record(entry.classification).type ?? entry.type);
}
