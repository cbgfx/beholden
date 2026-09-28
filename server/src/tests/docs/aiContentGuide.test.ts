/**
 * Keeps docs/guides/ai-content.md honest.
 *
 * The guide is handed to an AI that writes import files for Beholden, so every JSON example in it
 * must be accepted by the real validators and importers -- not a copy of their rules. This test
 * pulls every ```json block out of the guide, decides what kind of example it is from the section
 * it sits in, and runs it through the same code a real import uses:
 *
 * - compendium entries and batches: the Grand compendium schemas and batch/document parsers
 * - adventures and adventure fragments: POST /api/campaigns/:id/adventures/import
 * - the character example and character fragments: POST /api/me/characters
 *
 * Every JSON block must be covered by one of the checks, so a new example added to the guide
 * fails here until it is covered. The client-side character conversion is checked separately in
 * web-player/src/views/home/aiContentGuide.test.ts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import express from "express";
import multer from "multer";
import { CATEGORY_SCHEMAS, formatGrandCompendiumIssues } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { openDb, type Db } from "../../lib/db.js";
import { signToken } from "../../lib/jwtAuth.js";
import { requireAuth } from "../../middleware/auth.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import { registerAdventureRoutes } from "../../routes/adventures.js";
import { registerCharacterRoutes } from "../../routes/characters/core.js";
import { parseNativeCompendiumBatch, parseNativeCompendiumDocument } from "../../services/compendium/nativeCompendiumParsing.js";
import { seedDefaultSrdCompendium } from "../../services/compendium/defaultSrdCompendium.js";
import type { ServerContext } from "../../server/context.js";

type Json = Record<string, any>;
type Block = { line: number; json: Json; h1: string; h2: string; h3: string };

// MARK: - Guide parsing
const GUIDE_PATH = path.resolve(import.meta.dirname, "../../../../docs/guides/ai-content.md");

/** Every ```json block with the headings it sits under (line numbers are 1-based, for messages). */
function guideJsonBlocks(): Block[] {
  const lines = readFileSync(GUIDE_PATH, "utf8").split(/\r?\n/u);
  const blocks: Block[] = [];
  let h1 = "", h2 = "", h3 = "";
  let open: { line: number; body: string[] } | null = null;
  lines.forEach((text, index) => {
    if (open) {
      if (text.startsWith("```")) {
        blocks.push({ line: open.line, json: JSON.parse(open.body.join("\n")) as Json, h1, h2, h3 });
        open = null;
      } else open.body.push(text);
      return;
    }
    if (text.startsWith("# ")) [h1, h2, h3] = [text, "", ""];
    else if (text.startsWith("## ")) [h2, h3] = [text, ""];
    else if (text.startsWith("### ")) h3 = text;
    else if (text.startsWith("```json")) open = { line: index + 1, body: [] };
  });
  return blocks;
}

// MARK: - Fixture
let db: Db;
let server: http.Server;
let port = 0;
let seq = 0;
const token = signToken({ userId: "guide-user", username: "guide", isAdmin: true });

async function post(url: string, body: unknown): Promise<{ status: number; body: Json }> {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Json };
}

const describeFailure = (block: Block, detail: unknown) =>
  `ai-content.md line ${block.line} (${[block.h2, block.h3].filter(Boolean).join(" > ")}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;

// MARK: - Validation helpers
const schemaProblem = (category: string, value: unknown): string | null => {
  const result = CATEGORY_SCHEMAS[category as keyof typeof CATEGORY_SCHEMAS].safeParse(value);
  return result.success ? null : formatGrandCompendiumIssues(result.error);
};

const thrown = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const importAdventure = async (document: unknown): Promise<string | null> => {
  const response = await post("/api/campaigns/guide-campaign/adventures/import", document);
  return response.status === 200 ? null : JSON.stringify(response.body);
};

const adventure = (body: Json) => ({ format: "beholden.adventure", version: 2, adventure: { name: "Guide fragment", ...body } });
/** A tracker-only monster that carries a per-combatant fragment. */
const withCombatant = (extra: Json) => adventure({
  encounters: [{ name: "E", combatants: [{ baseType: "monster", baseId: "", name: "Thing", label: "Thing", hpMax: 10, hpCurrent: 10, ac: 12, ...extra }] }],
});

/** One kind of example: which guide blocks it covers and how each is validated. `validate`
 * returns a problem description, or null when the real import accepts the example. */
type Check = {
  name: string;
  covers: (block: Block) => boolean;
  minimum?: number;
  validate: (block: Block) => Promise<string | null> | string | null;
};

describe("docs/guides/ai-content.md examples are accepted by the real importers", () => {
  const blocks = guideJsonBlocks();

  // The full character example; character fragments are dropped into its characterData.
  const character = (blocks.find((block) => block.json.format === "beholden.character")?.json.character ?? {}) as Json;
  const createCharacter = async (characterData: Json, topLevel: Json = {}): Promise<string | null> => {
    const response = await post("/api/me/characters", { ...character, ...topLevel, characterData });
    return response.status === 200 ? null : JSON.stringify(response.body);
  };
  const withCharacterData = (patch: (json: Json) => Json, topLevel?: (json: Json) => Json) =>
    (block: Block) => createCharacter({ ...(character.characterData as Json), ...patch(block.json) }, topLevel?.(block.json));

  const inAdventure = (predicate: (block: Block) => boolean) => (block: Block) => block.h1 === "# Adventure import" && predicate(block);
  const inCharacter = (predicate: (block: Block) => boolean) => (block: Block) => block.h1 === "# Character import" && predicate(block);
  // Single entries are checked against the raw schema, with no legacy conversion.
  const otherCategory = (heading: string, category: string): Check => ({
    name: `${category} entry`,
    covers: (block) => block.h1 === "# Other native category entries" && block.h2 === heading,
    validate: (block) => schemaProblem(category, block.json),
  });

  const checks: Check[] = [
    // MARK: - Compendium
    {
      name: "compendium batch",
      covers: (block) => typeof block.json.category === "string" && Array.isArray(block.json.entries),
      validate: (block) => thrown(() => parseNativeCompendiumBatch(block.json))
        ?? (block.json.entries as unknown[]).map((entry) => schemaProblem(block.json.category, entry)).find(Boolean)
        ?? null,
    },
    {
      name: "flat compendium document",
      covers: (block) => block.json.format === "beholden.compendium" && !("category" in block.json),
      validate: (block) => thrown(() => parseNativeCompendiumDocument(block.json)),
    },
    otherCategory("## Spells", "spells"),
    otherCategory("## Classes", "classes"),
    otherCategory("## Species", "species"),
    otherCategory("## Backgrounds", "backgrounds"),
    otherCategory("## Feats", "feats"),
    otherCategory("## Decks", "decks"),
    otherCategory("## Bastions", "bastions"),

    // MARK: - Adventures
    { name: "adventure document", covers: (block) => block.json.format === "beholden.adventure", minimum: 2, validate: (block) => importAdventure(block.json) },
    { name: "adventure note", covers: inAdventure((b) => b.h2 === "## Notes"), validate: (block) => importAdventure(adventure({ notes: [block.json] })) },
    { name: "encounter", covers: inAdventure((b) => b.h2 === "## Encounters"), validate: (block) => importAdventure(adventure({ encounters: [block.json] })) },
    {
      name: "combatant",
      covers: inAdventure((b) => b.h2 === "## Combatants" && (b.h3 === "" || b.h3 === "### World Actions")),
      minimum: 2,
      validate: (block) => importAdventure(adventure({ encounters: [{ name: "E", combatants: [block.json] }] })),
    },
    { name: "attack overrides", covers: inAdventure((b) => b.h3 === "### Attack overrides"), validate: (block) => importAdventure(withCombatant({ attackOverrides: block.json })) },
    { name: "condition", covers: inAdventure((b) => b.h3 === "### Conditions"), validate: (block) => importAdventure(withCombatant({ conditions: [block.json] })) },
    { name: "overrides", covers: inAdventure((b) => b.h3 === "### Overrides"), validate: (block) => importAdventure(withCombatant({ overrides: block.json })) },
    {
      name: "adventure treasure",
      covers: inAdventure((b) => b.h3 === "### Custom treasure" || b.h3 === "### Existing compendium treasure"),
      minimum: 2,
      validate: (block) => importAdventure(adventure({ treasure: [block.json] })),
    },

    // MARK: - Characters
    {
      name: "character document",
      covers: (block) => block.json.format === "beholden.character",
      validate: (block) => block.json.version !== 2
        ? "the character example should use the current export version (2)"
        : createCharacter(character.characterData as Json),
    },
    // The class fragment may be for another level, and the server requires class levels to add
    // up to the character level, so it also sets the top-level level and class name to match.
    {
      name: "class entry",
      covers: inCharacter((b) => b.h3 === "### Identity and advancement"),
      validate: withCharacterData((json) => ({ classes: [json] }), (json) => ({ level: json.level, className: json.className })),
    },
    { name: "proficiencies", covers: inCharacter((b) => b.h3 === "### Proficiencies"), validate: withCharacterData((json) => ({ proficiencies: json })) },
    { name: "inventory item", covers: inCharacter((b) => b.h3 === "### Inventory" && !("ignoreWeight" in b.json)), validate: withCharacterData((json) => ({ inventory: [json] })) },
    { name: "inventory container", covers: inCharacter((b) => b.h3 === "### Inventory" && "ignoreWeight" in b.json), validate: withCharacterData((json) => ({ inventoryContainers: [json] })) },
    { name: "resource", covers: inCharacter((b) => b.h3 === "### Resources"), validate: withCharacterData((json) => ({ resources: [json] })) },
    { name: "player note", covers: inCharacter((b) => b.h3 === "### Notes, creatures, and spell state" && "title" in b.json), validate: withCharacterData((json) => ({ playerNotesList: [json] })) },
    { name: "tracked creature", covers: inCharacter((b) => b.h3 === "### Notes, creatures, and spell state" && "monsterId" in b.json), validate: withCharacterData((json) => ({ creatures: [json] })) },
  ];

  before(async () => {
    db = openDb(":memory:");
    // Adventure examples link SRD monsters and items, as a fresh install would have them.
    seedDefaultSrdCompendium(db);
    const now = Date.now();
    db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('guide-user', 'guide', 'x', 'Guide', 1, ?, ?)").run(now, now);
    db.prepare("INSERT INTO campaigns (id, name, ruleset, created_at, updated_at) VALUES ('guide-campaign', 'Guide', '5.5e', ?, ?)").run(now, now);
    const upload = multer({ storage: multer.memoryStorage() });
    const ctx = {
      db, broadcast: () => {}, upload, imageUpload: upload, compendiumUpload: upload, dbImportUpload: upload,
      helpers: {
        now: () => Date.now() + (++seq), uid: () => `guide-${++seq}`,
        normalizeKey: (value: string) => value, parseLeadingInt: () => null, normalizeHp: (value: unknown) => value,
        ensureCombat: () => {}, nextLabelNumber: () => 1, createPlayerCombatant: () => ({}), seedDefaultConditions: () => {},
      },
    } as unknown as ServerContext;
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use("/api", requireAuth);
    registerAdventureRoutes(app, ctx);
    registerCharacterRoutes(app, ctx);
    app.use(zodErrorMiddleware);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  for (const check of checks) {
    it(`${check.name} examples are accepted`, async () => {
      const covered = blocks.filter(check.covers);
      assert.ok(covered.length >= (check.minimum ?? 1), `Expected at least ${check.minimum ?? 1} "${check.name}" example(s); the guide section may have been renamed.`);
      // Collect every failing example so one run reports all of them.
      const problems: string[] = [];
      for (const block of covered) {
        const problem = await check.validate(block);
        if (problem) problems.push(describeFailure(block, problem));
      }
      assert.deepEqual(problems, []);
    });
  }

  it("every JSON example in the guide is covered by one of the checks above", () => {
    const unchecked = blocks.filter((block) => !checks.some((check) => check.covers(block)));
    assert.deepEqual(unchecked.map((block) => describeFailure(block, "not validated by this test")), []);
  });
});
