import React from "react";
import { CompendiumLeftColumn } from "@/views/CompendiumView/components/CompendiumLeftColumn";
import { CompendiumCenterColumn } from "@/views/CompendiumView/components/CompendiumCenterColumn";
import { CompendiumRightColumn } from "@/views/CompendiumView/components/CompendiumRightColumn";

export type CompendiumSection = "compendium" | "spells" | "rules" | "monsters" | "items";

export function CompendiumView() {
  const [activeSection, setActiveSection] = React.useState<CompendiumSection>("monsters");
  const [selectedSpellId, setSelectedSpellId] = React.useState<string | null>(null);
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  const handleSetSection = React.useCallback((s: CompendiumSection) => {
    setActiveSection(s);
    setSelectedSpellId(null);
    setSelectedMonsterId(null);
    setSelectedItemId(null);
  }, []);

  return (
    <div style={{ height: "100%", padding: 12, boxSizing: "border-box", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "200px 1fr 420px",
          gridTemplateRows: "1fr",
          gap: 14,
          alignItems: "stretch",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <CompendiumLeftColumn
          activeSection={activeSection}
          onSetSection={handleSetSection}
        />
        <CompendiumCenterColumn
          activeSection={activeSection}
          selectedSpellId={selectedSpellId}
          onSelectSpell={setSelectedSpellId}
          selectedMonsterId={selectedMonsterId}
          onSelectMonster={setSelectedMonsterId}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        />
        <CompendiumRightColumn
          activeSection={activeSection}
          selectedSpellId={selectedSpellId}
          selectedMonsterId={selectedMonsterId}
          selectedItemId={selectedItemId}
        />
      </div>
    </div>
  );
}
