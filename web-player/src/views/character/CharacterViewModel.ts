import type React from "react";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import type { CharacterCombatPanelsProps } from "@/views/character/combat/CharacterCombatPanels";
import type { useCompendiumMonster } from "@/views/character/creatures/CharacterCompendiumMonsterHooks";
import type { buildCharacterHpActions } from "@/views/character/combat/CharacterViewHpActions";
import type { buildCharacterRuntimeActions } from "@/views/character/combat/CharacterViewCombatActions";
import type { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import type { Character, PolymorphConditionData } from "@/views/character/CharacterViewHelpers";
import type { useCharacterData } from "@/views/character/state/useCharacterData";
import type { useCharacterLiveUpdates } from "@/views/character/state/useCharacterLiveUpdates";
import type { useCharacterPolymorphControls } from "@/views/character/creatures/useCharacterPolymorphControls";
import type { useCharacterViewNotes } from "@/views/character/notes/useCharacterViewNotes";
import type { CharacterViewUiState } from "@/views/character/useCharacterViewUiState";

export interface CharacterViewModel {
  char: Character;
  data: ReturnType<typeof useCharacterData>;
  derived: ReturnType<typeof buildCharacterViewDerivedState>;
  ui: CharacterViewUiState;
  notes: ReturnType<typeof useCharacterViewNotes>;
  runtime: ReturnType<typeof buildCharacterRuntimeActions>;
  hpActions: ReturnType<typeof buildCharacterHpActions>;
  live: ReturnType<typeof useCharacterLiveUpdates>;
  polymorphControls: ReturnType<typeof useCharacterPolymorphControls>;
  polymorphCondition: PolymorphConditionData | null;
  polymorphMonsterState: ReturnType<typeof useCompendiumMonster>;
  combatProps: CharacterCombatPanelsProps;
  handlePortraitSelected: React.ChangeEventHandler<HTMLInputElement>;
  handleAddFeat: (feat: { id: string; name: string }, abilityChoices: string[]) => Promise<void>;
  handleRemoveExtraFeat: (featId: string) => Promise<void>;
  applyPolymorphSelf: (row: CompendiumMonsterRow) => Promise<void>;
}
