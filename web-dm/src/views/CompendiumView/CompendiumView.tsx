import React from "react";
import { CompendiumLeftColumn } from "@/views/CompendiumView/components/CompendiumLeftColumn";
import { CompendiumCenterColumn } from "@/views/CompendiumView/components/CompendiumCenterColumn";
import { CompendiumRightColumn } from "@/views/CompendiumView/components/CompendiumRightColumn";

export type CompendiumSection = "compendium" | "spells" | "rules" | "monsters" | "items" | "feats" | "ai-help";

export function CompendiumView() {
  const [activeSection, setActiveSection] = React.useState<CompendiumSection>("rules");
  const [selectedSpellId, setSelectedSpellId] = React.useState<string | null>(null);
  const [selectedSpellRuleset, setSelectedSpellRuleset] = React.useState<"5e" | "5.5e" | null>(null);
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const [selectedFeatId, setSelectedFeatId] = React.useState<string | null>(null);

  const handleSetSection = React.useCallback((s: CompendiumSection) => {
    setActiveSection(s);
  }, []);

  const hasRightColumn = activeSection !== "rules" && activeSection !== "compendium" && activeSection !== "ai-help";

  return (
    <div style={{ height: "100%", padding: 12, boxSizing: "border-box", overflowX: "auto" }}>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: hasRightColumn ? "180px minmax(360px, 1fr) 420px" : "180px minmax(360px, 1fr)",
          gridTemplateRows: "1fr",
          gap: 14,
          alignItems: "stretch",
          minHeight: 0,

        }}
      >
        <CompendiumLeftColumn
          activeSection={activeSection}
          onSetSection={handleSetSection}
        />
        <CompendiumCenterColumn
          activeSection={activeSection}
          selectedSpellId={selectedSpellId}
          selectedSpellRuleset={selectedSpellRuleset}
          onSelectSpell={(id, ruleset) => {
            setSelectedSpellId(id);
            setSelectedSpellRuleset(ruleset ?? null);
          }}
          selectedMonsterId={selectedMonsterId}
          onSelectMonster={setSelectedMonsterId}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          selectedFeatId={selectedFeatId}
          onSelectFeat={setSelectedFeatId}
        />
        {hasRightColumn && (
          <CompendiumRightColumn
            activeSection={activeSection}
            selectedSpellId={selectedSpellId}
            selectedSpellRuleset={selectedSpellRuleset}
            selectedMonsterId={selectedMonsterId}
            selectedItemId={selectedItemId}
            selectedFeatId={selectedFeatId}
          />
        )}
      </div>
    </div>
  );
}
