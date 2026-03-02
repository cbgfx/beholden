import * as React from "react";
import { IconPlayer, IconMonster, IconINPC, IconSkull } from "@/icons";
import type { Combatant } from "@/domain/types/domain";

type Props = {
  combatant: Combatant | undefined;
};

export function CombatantTypeIcon({ combatant }: Props) {
  if (!combatant) return null;

  const isDead = Number(combatant.hpCurrent ?? 0) <= 0;
  if (isDead) return <IconSkull size={16} title="Dead" />;

  if (combatant.baseType === "player") return <IconPlayer size={16} title="Player" />;
  if (combatant.baseType === "inpc") return <IconINPC size={16} title="Important NPC" />;
  return <IconMonster size={16} title="Monster" />;
}
