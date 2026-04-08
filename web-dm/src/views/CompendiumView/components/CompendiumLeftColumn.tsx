import React from "react";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { CompendiumNavMenu } from "@/views/CompendiumView/components/CompendiumNavMenu";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";
import { useAuth } from "@/contexts/AuthContext";

export function CompendiumLeftColumn(props: {
  activeSection: CompendiumSection;
  onSetSection: (s: CompendiumSection) => void;
}) {
  const { user } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 }}>
      <Panel
        title="Reference"
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
          Import or manage your compendium XML data under the Compendium section.
        </div>
      )}
    </div>
  );
}
