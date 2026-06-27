import React from "react";
import { C, withAlpha } from "@/lib/theme";
import { MonsterBrowserPanel } from "./panels/MonsterBrowserPanel";
import { MonsterDetailPanel } from "./panels/MonsterDetailPanel";
import { SpellsPanel } from "./panels/SpellsPanel";
import { SpellDetailPanel } from "./panels/SpellDetailPanel";
import { ItemsBrowserPanel } from "./panels/ItemsBrowserPanel";
import { ItemDetailPanel } from "./panels/ItemDetailPanel";
import { RulesReferencePanel } from "./panels/RulesReferencePanel";
import { FeatsPanel } from "./panels/FeatsPanel";
import { FeatDetailPanel } from "./panels/FeatDetailPanel";
import { Panel } from "@/ui/Panel";
import { IconMonster, IconSpells, IconChest, IconNotes } from "@/ui/Icons";
import { IconInspiration } from "@/icons";

type Section = "monsters" | "spells" | "items" | "feats" | "rules";

const NAV: { id: Section; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "monsters", label: "Monsters",       Icon: IconMonster },
  { id: "spells",   label: "Spells",         Icon: IconSpells },
  { id: "items",    label: "Items",          Icon: IconChest },
  { id: "feats",    label: "Feats",          Icon: IconInspiration },
  { id: "rules",    label: "Rules Reference",Icon: IconNotes },
];

function NavButton({ label, Icon, active, onClick }: { label: string; Icon: React.FC<{ size?: number }>; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", border: "none", borderRadius: 10,
        cursor: "pointer", textAlign: "left",
        fontWeight: active ? 800 : 500, fontSize: "var(--fs-medium)",
        color: active ? C.accentHl : C.text,
        background: active ? withAlpha(C.accentHl, 0.12) : "transparent",
        fontFamily: "inherit",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <Icon size={20} />
      {label}
    </button>
  );
}

export function CompendiumView() {
  const [activeSection, setActiveSection] = React.useState<Section>("monsters");
  const [selectedSpellId, setSelectedSpellId] = React.useState<string | null>(null);
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const [selectedFeatId, setSelectedFeatId] = React.useState<string | null>(null);

  const handleSetSection = React.useCallback((s: Section) => {
    setActiveSection(s);
    setSelectedSpellId(null);
    setSelectedMonsterId(null);
    setSelectedItemId(null);
    setSelectedFeatId(null);
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
              {NAV.map(({ id, label, Icon }) => (
                <NavButton key={id} label={label} Icon={Icon} active={activeSection === id} onClick={() => handleSetSection(id)} />
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
          {activeSection === "feats" && (
            <FeatsPanel selectedFeatId={selectedFeatId} onSelectFeat={setSelectedFeatId} />
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
            {activeSection === "feats" && (
              selectedFeatId
                ? <FeatDetailPanel featId={selectedFeatId} />
                : <Panel title="Feat Detail" style={{ flex: 1 }} bodyStyle={{ flex: 1 }}>
                    <div style={{ color: C.muted }}>Select a feat to view its details.</div>
                  </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
