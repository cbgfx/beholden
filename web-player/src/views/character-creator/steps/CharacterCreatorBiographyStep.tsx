import { WysiwygNoteEditor } from "@beholden/shared/ui";
import { UiText } from "@beholden/shared/i18n/useUiTranslation";
import { C } from "@/lib/theme";
import { NavButtons } from "../shared/CharacterCreatorParts";
import { headingStyle } from "../shared/CharacterCreatorStyles";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";
export function renderBiographyFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return {
    main: <div>
      <h2 style={headingStyle}><UiText text="Biography" namespace="playerUi" /></h2>
      <WysiwygNoteEditor value={ctx.form.biography} onChange={(value) => ctx.setField("biography", value)} minHeight={420}
        theme={{ radius: 10, panelBorder: C.panelBorder, inputBg: C.bg, text: C.text }} />
      <NavButtons step={11} onBack={() => ctx.setStep(10)} onNext={() => ctx.setStep(12)} />
    </div>, side: ctx.sideSummary,
  };
}

