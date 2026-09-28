import * as React from "react";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { CompendiumView as SharedCompendiumView, type CompendiumExtraSection } from "@beholden/shared/views/compendium/CompendiumView";
import { IconAI, IconCompendiumAlt } from "@/icons";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { useAuth } from "@/contexts/AuthContext";
import { AiHelpPanel } from "./panels/AiHelpPanel";
import { CompendiumAdminPanel } from "./panels/CompendiumAdminPanel";
import { useCompendiumEditing } from "./useCompendiumEditing";

/**
 * The DM's compendium: the shared compendium with editing turned on, plus the DM-only sections
 * (compendium import for admins, and the AI content guide).
 */
export function CompendiumView() {
  const translateUi = useUiTranslation("dmUi");
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  // Bumped after the DM's own saves, so they show even if the live connection has dropped.
  const [localRevision, setLocalRevision] = React.useState(0);
  const onChanged = React.useCallback(() => setLocalRevision((value) => value + 1), []);
  const { editing, modals } = useCompendiumEditing(onChanged);

  const extraSections: CompendiumExtraSection[] = [
    ...(isAdmin ? [{ id: "compendium", label: translateUi("Compendium"), icon: <IconCompendiumAlt size={20} />, render: () => <CompendiumAdminPanel /> }] : []),
    { id: "ai-help", label: translateUi("AI Guide"), icon: <IconAI size={20} />, render: () => <AiHelpPanel /> },
  ];

  return (
    <>
      <SharedCompendiumView
        Panel={Panel}
        editing={editing}
        localRevision={localRevision}
        extraSections={extraSections}
        navFooter={isAdmin ? (
          <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, lineHeight: 1.4, padding: "0 4px" }}>
            {translateUi("Import or manage canonical Beholden compendium JSON under the Compendium section.")}
          </div>
        ) : null}
      />
      {modals}
    </>
  );
}
