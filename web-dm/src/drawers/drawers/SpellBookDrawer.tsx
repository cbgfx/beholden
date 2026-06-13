import React from "react";
import type { DrawerContent } from "@/drawers/types";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { SpellsPanel } from "@/views/CompendiumView/panels/SpellsPanel";
import { SpellDetailPanel } from "@/views/CompendiumView/panels/SpellDetailPanel";

export function SpellBookDrawer(props: { close: () => void }): DrawerContent {
  const [selectedSpellId, setSelectedSpellId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  return {
    body: (
      <div style={{ height: "calc(100vh - 160px)", minHeight: 420, minWidth: 0 }}>
        {/*
          Combat Spell Book should be fast + uncluttered.
          Keep the drawer as a simple list; show spell text in a modal.
        */}
        <SpellsPanel
          embedded
          selectedSpellId={selectedSpellId}
          onSelectSpell={(id) => {
            setSelectedSpellId(id);
            setDetailOpen(true);
          }}
        />

        <Modal
          isOpen={detailOpen}
          title="Spell"
          width={980}
          height={760}
          onClose={() => setDetailOpen(false)}
        >
          <div style={{ height: "100%", padding: 14, overflow: "hidden", display: "flex" }}>
            {selectedSpellId ? (
              <SpellDetailPanel spellId={selectedSpellId} />
            ) : (
              <div style={{ opacity: 0.7 }}>Select a spell</div>
            )}
          </div>
        </Modal>
      </div>
    ),
    footer: <Button onClick={props.close}>Done</Button>
  };
}