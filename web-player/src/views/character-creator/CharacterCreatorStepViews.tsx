import type { CharacterCreatorStepRenderContext, StepRenderResult } from "@/views/character-creator/steps/CharacterCreatorStepContext";
import { renderRulesetFromContext } from "@/views/character-creator/steps/CharacterCreatorRulesetStep";
import { renderClassFromContext } from "@/views/character-creator/steps/CharacterCreatorClassStep";
import { renderSpeciesFromContext } from "@/views/character-creator/steps/CharacterCreatorSpeciesStep";
import { renderBackgroundFromContext } from "@/views/character-creator/steps/CharacterCreatorBackgroundStep";
import { renderAbilityScoresFromContext, renderDerivedStatsFromContext } from "@/views/character-creator/steps/CharacterCreatorPanelAdvancedSteps";
import { renderLevelFromContext } from "@/views/character-creator/steps/CharacterCreatorPanelLevelStep";
import { renderSkillsFromContext } from "@/views/character-creator/steps/CharacterCreatorSkillsStep";
import { renderSpellsFromContext } from "@/views/character-creator/steps/CharacterCreatorSpellsStep";
import { renderIdentityFromContext } from "@/views/character-creator/steps/CharacterCreatorIdentityStep";
import { renderCampaignsFromContext } from "@/views/character-creator/steps/CharacterCreatorCampaignsStep";

export type { CharacterCreatorStepRenderContext };

export function renderCharacterCreatorStep(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  switch (ctx.step) {
    case 1: return renderRulesetFromContext(ctx);
    case 2: return renderClassFromContext(ctx);
    case 3: return renderSpeciesFromContext(ctx);
    case 4: return renderBackgroundFromContext(ctx);
    case 5: return renderAbilityScoresFromContext(ctx);
    case 6: return renderLevelFromContext(ctx);
    case 7: return renderSkillsFromContext(ctx);
    case 8: return renderSpellsFromContext(ctx);
    case 9: return renderDerivedStatsFromContext(ctx);
    case 10: return renderIdentityFromContext(ctx);
    case 11: return renderCampaignsFromContext(ctx);
    default: return { main: null, side: null };
  }
}
