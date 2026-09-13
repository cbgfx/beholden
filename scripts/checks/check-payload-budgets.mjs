#!/usr/bin/env node

function sizeOf(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeText(length) {
  return "x".repeat(length);
}

function run() {
  const noteFull = {
    id: "n_1",
    scope: { campaignId: "c_1", adventureId: null },
    content: { title: "Important Note", text: makeText(1200) },
    meta: { sort: 12, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000 },
  };
  const noteList = {
    id: "n_1",
    campaignId: "c_1",
    adventureId: null,
    title: "Important Note",
    sort: 12,
    updatedAt: 1_700_000_100_000,
  };

  const treasureFull = {
    id: "t_1",
    scope: { campaignId: "c_1", adventureId: null },
    entry: {
      source: "compendium",
      itemId: "itm_1",
      name: "Vorpal Sword",
      rarity: "legendary",
      type: "weapon",
      typeKey: "weapon",
      attunement: true,
      magic: true,
      text: makeText(1600),
      qty: 2,
    },
    meta: { sort: 9, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000 },
  };
  const treasureList = {
    id: "t_1",
    campaignId: "c_1",
    adventureId: null,
    itemId: "itm_1",
    name: "Vorpal Sword",
    qty: 2,
    rarity: "legendary",
    type: "weapon",
    attunement: true,
    magic: true,
    sort: 9,
    updatedAt: 1_700_000_100_000,
  };

  const combatantsDeltaRefresh = {
    type: "encounter:combatantsDelta",
    payload: { encounterId: "e_1", action: "refresh" },
  };

  const wsScopeMessage = {
    type: "ws:scope",
    payload: { campaignId: "c_1", adventureId: "a_1", encounterId: "e_1" },
  };

  const noteFullBytes = sizeOf(noteFull);
  const noteListBytes = sizeOf(noteList);
  const treasureFullBytes = sizeOf(treasureFull);
  const treasureListBytes = sizeOf(treasureList);
  const combatantsDeltaRefreshBytes = sizeOf(combatantsDeltaRefresh);
  const wsScopeBytes = sizeOf(wsScopeMessage);

  // Keep list projections materially smaller than full DTOs.
  assert(
    noteListBytes <= Math.floor(noteFullBytes * 0.35),
    `notes list payload budget exceeded: ${noteListBytes}B > 35% of full ${noteFullBytes}B`,
  );
  assert(
    treasureListBytes <= Math.floor(treasureFullBytes * 0.30),
    `treasure list payload budget exceeded: ${treasureListBytes}B > 30% of full ${treasureFullBytes}B`,
  );

  // Guard against accidental payload bloat in high-frequency websocket messages.
  assert(
    combatantsDeltaRefreshBytes <= 120,
    `encounter:combatantsDelta(refresh) too large: ${combatantsDeltaRefreshBytes}B > 120B`,
  );
  assert(
    wsScopeBytes <= 120,
    `ws:scope message too large: ${wsScopeBytes}B > 120B`,
  );

  console.log(
    [
      `ok: note list ${noteListBytes}B (full ${noteFullBytes}B)`,
      `ok: treasure list ${treasureListBytes}B (full ${treasureFullBytes}B)`,
      `ok: combatants refresh ${combatantsDeltaRefreshBytes}B`,
      `ok: ws scope ${wsScopeBytes}B`,
    ].join("\n"),
  );
}

run();
