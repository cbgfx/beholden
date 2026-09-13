import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { Button } from "@/ui/Button";

export function EncounterRosterHeaderActions(props: {
  onAddAllPlayers: () => void;
  onOpenCombat: () => void;
}) {
  const translateUi = useUiTranslation("dmUi");
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <Button variant="ghost" onClick={props.onAddAllPlayers}>
        {translateUi("Add ALL players")}
      </Button>
      <Button variant="ghost" onClick={props.onOpenCombat}>
        {translateUi("Open Combat")}
      </Button>
    </div>
  );
}
