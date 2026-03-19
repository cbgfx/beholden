import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconCompendiumAlt, IconSpells, IconNotes, IconMonster, IconChest } from "@/icons";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";

const NAV_ITEMS: { section: CompendiumSection; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { section: "compendium", label: "Compendium",          Icon: IconCompendiumAlt },
  { section: "items",      label: "Items",           Icon: IconChest },
  { section: "monsters",   label: "Monsters",        Icon: IconMonster },
  { section: "rules",      label: "Rules Reference", Icon: IconNotes },
  { section: "spells",     label: "Spells",          Icon: IconSpells },
];

export function CompendiumNavMenu(props: {
  activeSection: CompendiumSection;
  onSetSection: (s: CompendiumSection) => void;
}) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {NAV_ITEMS.map(({ section, label, Icon }) => {
        const active = props.activeSection === section;
        return (
          <button
            key={section}
            type="button"
            onClick={() => props.onSetSection(section)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left",
              fontWeight: active ? 800 : 500,
              fontSize: "var(--fs-medium)",
              color: active ? theme.colors.accentHighlight : theme.colors.text,
              background: active ? withAlpha(theme.colors.accentHighlight, 0.12) : "transparent",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              if (!active)
                (e.currentTarget as HTMLButtonElement).style.background = withAlpha(theme.colors.accentHighlight, 0.07);
            }}
            onMouseLeave={(e) => {
              if (!active)
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Icon size={20} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
