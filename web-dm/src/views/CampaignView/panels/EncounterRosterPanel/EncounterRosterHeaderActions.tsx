import React from "react";
import { Button } from "@/ui/Button";

export function EncounterRosterHeaderActions(props: {
  onAddAllPlayers: () => void;
  onOpenCombat: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <Button variant="ghost" onClick={props.onAddAllPlayers}>
        Add ALL players
      </Button>
      <Button variant="ghost" onClick={props.onOpenCombat}>
        Open Combat
      </Button>
    </div>
  );
}
