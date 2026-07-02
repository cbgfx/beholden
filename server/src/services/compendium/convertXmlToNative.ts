import BetterSqlite3 from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { importCompendiumXml } from "./importXml.js";
import {
  exportNativeCompendiumBundle,
  parseNativeCompendiumDocument,
  type NativeCompendiumBundle,
} from "./nativeCompendium.js";

/**
 * Translate legacy XML into a portable Beholden JSON document without touching
 * the live application database.
 */
export function convertCompendiumXmlToNative(xml: string): NativeCompendiumBundle & { warnings: string[] } {
  const db = new BetterSqlite3(":memory:");
  try {
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA_SQL);
    const { warnings } = importCompendiumXml({ xml, db });
    const document = exportNativeCompendiumBundle(db);
    // The converter is the only heuristic boundary. Never let it download a
    // document that the strict native importer would reject later.
    parseNativeCompendiumDocument(document);
    return { ...document, warnings };
  } finally {
    db.close();
  }
}
