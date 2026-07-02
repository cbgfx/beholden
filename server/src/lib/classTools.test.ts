import assert from "node:assert/strict";
import test from "node:test";
import {
  ARTISAN_TOOLS,
  MUSICAL_INSTRUMENTS,
  parseClassTools,
} from "./proficiencyConstants.js";

test("class tools: None produces no proficiencies or notes", () => {
  assert.deepEqual(parseClassTools("None"), { fixed: [], choices: [], notes: [] });
});

test("class tools: fixed tools remain fixed", () => {
  assert.deepEqual(parseClassTools("Thieves' Tools, Herbalism Kit"), {
    fixed: ["Thieves' Tools", "Herbalism Kit"],
    choices: [],
    notes: [],
  });
});

test("class tools: Bard chooses three musical instruments", () => {
  assert.deepEqual(parseClassTools("3 Musical Instruments"), {
    fixed: [],
    choices: [{ count: 3, from: MUSICAL_INSTRUMENTS }],
    notes: [],
  });
});

test("class tools: Monk chooses from either tool category", () => {
  assert.deepEqual(
    parseClassTools("Any one type of Artisan’s Tools or any one Musical Instrument of your choice"),
    {
      fixed: [],
      choices: [{ count: 1, from: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS] }],
      notes: [],
    },
  );
});

test("class tools: Artificer keeps fixed tools and its artisan choice", () => {
  assert.deepEqual(
    parseClassTools("Thieves' Tools, Tinker's Tools, one type of Artisan's Tools of your choice"),
    {
      fixed: ["Thieves' Tools", "Tinker's Tools"],
      choices: [{ count: 1, from: ARTISAN_TOOLS }],
      notes: [],
    },
  );
});

test("class tools: unknown legacy rules survive in notes", () => {
  assert.deepEqual(parseClassTools("One tool blessed by the Moon Court"), {
    fixed: [],
    choices: [],
    notes: ["One tool blessed by the Moon Court"],
  });
});
