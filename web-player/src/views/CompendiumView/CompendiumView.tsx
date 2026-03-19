import React from "react";
import { C, withAlpha } from "@/lib/theme";
import { MonsterBrowserPanel } from "./panels/MonsterBrowserPanel";
import { MonsterDetailPanel } from "./panels/MonsterDetailPanel";
import { SpellsPanel } from "./panels/SpellsPanel";
import { SpellDetailPanel } from "./panels/SpellDetailPanel";
import { ItemsBrowserPanel } from "./panels/ItemsBrowserPanel";
import { ItemDetailPanel } from "./panels/ItemDetailPanel";
import { RulesReferencePanel } from "./panels/RulesReferencePanel";
import { Panel } from "@/ui/Panel";

type Section = "monsters" | "spells" | "items" | "rules";

const NAV: { id: Section; label: string }[] = [
  { id: "monsters", label: "Monsters" },
  { id: "spells",   label: "Spells" },
  { id: "items",    label: "Items" },
  { id: "rules",    label: "Rules Reference" },
];

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", width: "100%",
        padding: "10px 14px", border: "none", borderRadius: 10,
        cursor: "pointer", textAlign: "left",
        fontWeight: active ? 800 : 500, fontSize: 14,
        color: active ? C.accentHl : C.text,
        background: active ? withAlpha(C.accentHl, 0.12) : "transparent",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

export function CompendiumView() {
  const [activeSection, setActiveSection] = React.useState<Section>("monsters");
  const [selectedSpellId, setSelectedSpellId] = React.useState<string | null>(null);
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  const handleSetSection = React.useCallback((s: Section) => {
    setActiveSection(s);
    setSelectedSpellId(null);
    setSelectedMonsterId(null);
    setSelectedItemId(null);
  }, []);

  const hasRightColumn = activeSection !== "rules";

  return (
    <div style={{ height: "100%", padding: 12, boxSizing: "border-box", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: hasRightColumn ? "200px 1fr 420px" : "200px 1fr",
          gap: 14,
          alignItems: "stretch",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 }}>
          <Panel title="Reference" style={{ display: "flex", flexDirection: "column" }}>
            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV.map(({ id, label }) => (
                <NavButton key={id} label={label} active={activeSection === id} onClick={() => handleSetSection(id)} />
              ))}
            </nav>
          </Panel>
        </div>

        {/* Center */}
        <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeSection === "monsters" && (
            <MonsterBrowserPanel
              selectedMonsterId={selectedMonsterId}
              onSelectMonster={setSelectedMonsterId}
            />
          )}
          {activeSection === "spells" && (
            <SpellsPanel selectedSpellId={selectedSpellId} onSelectSpell={setSelectedSpellId} />
          )}
          {activeSection === "items" && (
            <ItemsBrowserPanel selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
          )}
          {activeSection === "rules" && <RulesReferencePanel />}
        </div>

        {/* Right detail */}
        {hasRightColumn && (
          <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeSection === "monsters" && (
              selectedMonsterId
                ? <MonsterDetailPanel monsterId={selectedMonsterId} />
                : <Panel title="Stat Block" style={{ flex: 1 }} bodyStyle={{ flex: 1 }}>
                    <div style={{ color: C.muted }}>Select a monster to view its stat block.</div>
                  </Panel>
            )}
            {activeSection === "spells" && (
              selectedSpellId
                ? <SpellDetailPanel spellId={selectedSpellId} />
                : <Panel title="Spell Detail" style={{ flex: 1 }} bodyStyle={{ flex: 1 }}>
                    <div style={{ color: C.muted }}>Select a spell to view its description.</div>
                  </Panel>
            )}
            {activeSection === "items" && (
              selectedItemId
                ? <ItemDetailPanel itemId={selectedItemId} />
                : <Panel title="Item Detail" style={{ flex: 1 }} bodyStyle={{ flex: 1 }}>
                    <div style={{ color: C.muted }}>Select an item to view its details.</div>
                  </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
