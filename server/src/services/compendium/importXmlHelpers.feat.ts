import type Database from "better-sqlite3";
import { parseFeat } from "../../lib/featParser.js";
import { normalizeKey } from "../../lib/text.js";
import { pruneFeatBlob } from "./blobHygiene.js";

export function createFeatUpserter(
  featStmt: Database.Statement,
) {
  return (args: {
    name: string;
    text: string;
    prerequisite?: string | null;
    proficiency?: string | null;
    special?: string | null;
    repeatable?: string | null;
    modifierDetails?: Array<{ category: string; text: string }>;
  }) => {
    const name = args.name.trim();
    const nameKey = normalizeKey(name);
    const id = `f_${nameKey.replace(/\s/g, "_")}`;
    const modifierDetails = (args.modifierDetails ?? []).filter((m) => m.text.length > 0);
    const modifiers = modifierDetails.map((m) => m.text);
    const prerequisite = args.prerequisite ?? null;
    const proficiency = args.proficiency ?? null;
    const special = args.special ?? null;
    const repeatable = /^(?:1|true|yes)$/iu.test(args.repeatable ?? "");
    const parsed = parseFeat({
      name,
      text: args.text,
      prerequisite,
      proficiency,
      modifiers: modifierDetails,
    });
    const data = {
      id,
      name,
      nameKey,
      name_key: nameKey,
      text: args.text,
      prerequisite,
      proficiency,
      special,
      repeatable,
      modifiers,
      modifierDetails,
      parsed,
    };

    featStmt.run(id, name, nameKey, JSON.stringify(pruneFeatBlob(data as Record<string, unknown>)));
  };
}
