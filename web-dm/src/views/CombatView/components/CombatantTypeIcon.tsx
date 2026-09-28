import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { IconWorldAction, IconPlayer, IconMonster, IconINPC, IconSkull } from "@/icons";
import type { EncounterActor } from "@/domain/types/domain";

type Props = {
  combatant: EncounterActor | undefined;
};

export function CombatantTypeIcon({ combatant }: Props) {
  const translateUi = useUiTranslation("dmUi");
  if (!combatant) return null;

  if (combatant.baseType === "world") return <IconWorldAction size={16} title={translateUi("World Action")} />;
  const isDead = Number(combatant.hpCurrent ?? 0) <= 0;
  if (isDead) return <IconSkull size={16} title={translateUi("Dead")} />;

  if (combatant.baseType === "player") return <IconPlayer size={16} title={translateUi("Player")} />;
  if (combatant.baseType === "inpc") return <IconINPC size={16} title={translateUi("Important NPC")} />;
  return <IconMonster size={16} title={translateUi("Monster")} />;
}
