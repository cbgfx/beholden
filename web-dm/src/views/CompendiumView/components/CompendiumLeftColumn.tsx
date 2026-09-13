import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { CompendiumNavMenu } from "@/views/CompendiumView/components/CompendiumNavMenu";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";
import { useAuth } from "@/contexts/AuthContext";

export function CompendiumLeftColumn(props: {
  activeSection: CompendiumSection;
  onSetSection: (s: CompendiumSection) => void;
}) {
  const translateUi = useUiTranslation("dmUi");
  const { user } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 }}>
      <Panel
        title={translateUi("Reference")}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <CompendiumNavMenu
          activeSection={props.activeSection}
          onSetSection={props.onSetSection}
        />
      </Panel>

      {user?.isAdmin && (
        <div
          style={{
            fontSize: "var(--fs-small)",
            color: theme.colors.muted,
            lineHeight: 1.4,
            padding: "0 4px",
          }}
        >
          {translateUi("Import or manage canonical Beholden compendium JSON under the Compendium section.")}
        </div>
      )}
    </div>
  );
}
