import * as React from "react";
import { IconPlayer, IconMonster, IconPerson, IconSkull } from "@/icons";

type Props = {
  combatant: any;
};

export function CombatantTypeIcon({ combatant }: Props) {
  if (!combatant) return null;

  const isDead = Number(combatant.hpCurrent) <= 0;
  if (isDead) return <IconSkull size={16} title="Dead" />;

  const bt = (combatant.baseType ?? combatant.type ?? "").toString();
  if (bt === "player") return <IconPlayer size={16} title="Player" />;
  if (bt === "inpc") return <IconPerson size={16} title="Important NPC" />;
  return <IconMonster size={16} title="Monster" />;
}
