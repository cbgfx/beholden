import React, { useState } from "react";
import { SpellsPanel } from "@/views/CompendiumView/panels/SpellsPanel";
import { SpellDetailPanel } from "../panels/SpellDetailPanel";

export function SpellBrowserSplit() {
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      {/* LEFT — Spell List */}
      <div
        style={{
          width: 320,
          borderRight: "1px solid var(--panel-border)",
          overflowY: "auto",
          minHeight: 0
        }}
      >
        <SpellsPanel
          embedded
          onSelectSpell={setSelectedSpellId}
          selectedSpellId={selectedSpellId}
        />
      </div>

      {/* RIGHT — Spell Detail */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: 16
        }}
      >
        {selectedSpellId ? (
          <SpellDetailPanel spellId={selectedSpellId} />
        ) : (
          <div style={{ opacity: 0.5 }}>Select a spell</div>
        )}
      </div>
    </div>
  );
}
