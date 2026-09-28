import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import type { DrawerContent } from "@/drawers/types";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { CompendiumHostProvider, useCompendiumRevision } from "@beholden/shared/views/compendium/CompendiumHost";
import { SpellBrowser } from "@beholden/shared/views/compendium/SpellBrowser";
import { SpellDetail } from "@beholden/shared/views/compendium/SpellDetail";

export function SpellBookDrawer(props: { close: () => void }): DrawerContent {
  const translateUi = useUiTranslation("dmUi");
  const [selectedSpellId, setSelectedSpellId] = React.useState<string | null>(null);
  const [selectedSpellRuleset, setSelectedSpellRuleset] = React.useState<"5e" | "5.5e" | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [revision] = useCompendiumRevision();
  const host = React.useMemo(() => ({ Panel, revision }), [revision]);

  return {
    body: (
      <CompendiumHostProvider value={host}>
      <div style={{ height: "calc(100vh - 160px)", minHeight: 420, minWidth: 0 }}>
        {/*
          Combat Spell Book should be fast + uncluttered.
          Keep the drawer as a simple list; show spell text in a modal.
        */}
        <SpellBrowser
          selectedSpellId={selectedSpellId}
          selectedSpellRuleset={selectedSpellRuleset}
          onSelectSpell={(id, ruleset) => {
            setSelectedSpellId(id);
            setSelectedSpellRuleset(ruleset ?? null);
            setDetailOpen(Boolean(id));
          }}
        />

        <Modal
          isOpen={detailOpen}
          title={translateUi("Spell")}
          width={980}
          height={760}
          onClose={() => setDetailOpen(false)}
        >
          <div style={{ height: "100%", padding: 14, overflow: "hidden", display: "flex" }}>
            {selectedSpellId ? (
              <SpellDetail spellId={selectedSpellId} ruleset={selectedSpellRuleset} />
            ) : (
              <div style={{ opacity: 0.7 }}>{translateUi("Select a spell")}</div>
            )}
          </div>
        </Modal>
      </div>
      </CompendiumHostProvider>
    ),
    footer: <Button onClick={props.close}>{translateUi("Done")}</Button>
  };
}