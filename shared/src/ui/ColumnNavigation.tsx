import { useEffect, useState } from "react";
import {
  IconShield,
  IconDice,
  IconSpells,
  IconChest,
  IconNotes,
  IconHeal,
  IconPlayer,
  IconEncounter,
  IconTargeted,
  IconAdventure,
} from "../icons";
import { useUiTranslation } from "../i18n/useUiTranslation";
import { Icon as GameIcon } from "@iconify/react";
import { GameIconPickerDialog } from "./GameIconPickerDialog";
import { LAYOUT_COLORS as C } from "./layoutTheme";
import type { ColumnHeader, ColumnIconId } from "../domain/layoutColumns";
export interface ColumnView {
  columns: number;
  columnHeaders?: ColumnHeader[];
  /** Defaults are supplied and localized by the owning app. */
  columnDefaults?: ColumnHeader[];
}

const icons: Record<
  Exclude<ColumnIconId, `game-icons:${string}`>,
  typeof IconShield
> = {
  stats: IconShield,
  actions: IconDice,
  spells: IconSpells,
  inventory: IconChest,
  notes: IconNotes,
  rest: IconHeal,
  players: IconPlayer,
  encounter: IconEncounter,
  target: IconTargeted,
  adventure: IconAdventure,
};
function ColumnIcon({ icon, size }: { icon: ColumnIconId; size: number }) {
  if (icon.startsWith("game-icons:"))
    return <GameIcon icon={icon} width={size} height={size} />;
  const Icon = icons[icon as keyof typeof icons];
  return <Icon size={size} />;
}
export function sheetColumnPresentation(view: ColumnView, index: number) {
  const fallback = view.columnDefaults?.[index];
  return {
    name: view.columnHeaders?.[index]?.name,
    fallbackName: fallback?.name,
    icon: view.columnHeaders?.[index]?.icon ?? fallback?.icon,
  };
}

export function ColumnHeading({
  view,
  index,
  editing,
  accent,
  onChange,
}: {
  view: ColumnView;
  index: number;
  editing: boolean;
  accent: string;
  onChange: (header: ColumnHeader) => void;
}) {
  const t = useUiTranslation("sharedUi");
  const presentation = sheetColumnPresentation(view, index);
  const name =
    presentation.name ??
    (presentation.fallbackName
      ? presentation.fallbackName
      : t("Column {{number}}", { number: index + 1 }));
  const [pickingIcon, setPickingIcon] = useState(false);
  const [draft, setDraft] = useState(presentation.name ?? "");
  useEffect(() => setDraft(presentation.name ?? ""), [presentation.name]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        minWidth: 0,
        padding: "8px 4px",
        color: accent,
      }}
    >
      {editing ? (
        <button
          type="button"
          aria-label={t("Column {{number}} icon", { number: index + 1 })}
          onClick={() => setPickingIcon(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
            minHeight: 44,
            color: accent,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ColumnIcon icon={presentation.icon ?? "notes"} size={22} />
        </button>
      ) : (
        <ColumnIcon icon={presentation.icon ?? "notes"} size={22} />
      )}
      {pickingIcon ? (
        <GameIconPickerDialog
          value={presentation.icon}
          onClose={() => setPickingIcon(false)}
          onSelect={(icon) => {
            onChange({ ...view.columnHeaders?.[index], icon });
            setPickingIcon(false);
          }}
        />
      ) : null}
      {editing ? (
        <>
          <input
            aria-label={t("Column {{number}} name", { number: index + 1 })}
            placeholder={name}
            value={draft}
            maxLength={60}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft.trim() !== (presentation.name ?? ""))
                onChange({
                  ...view.columnHeaders?.[index],
                  name: draft.trim(),
                });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            style={{
              minWidth: 0,
              flex: 1,
              padding: "8px",
              color: C.text,
              background: C.bg,
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 8,
            }}
          />
        </>
      ) : (
        <h2
          style={{
            margin: 0,
            fontSize: "var(--fs-subtitle)",
            overflowWrap: "anywhere",
          }}
        >
          {name}
        </h2>
      )}
    </div>
  );
}

export function ColumnTabs({
  view,
  active,
  onSelect,
  accent,
}: {
  view: ColumnView;
  active: number;
  onSelect: (index: number) => void;
  accent: string;
}) {
  const t = useUiTranslation("sharedUi");
  return (
    <nav
      aria-label={t("View columns")}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${view.columns}, minmax(0, 1fr))`,
        gap: 0,
        flexShrink: 0,
        borderTop: `1px solid ${C.panelBorder}`,
        background: C.bg,
        padding: "4px 6px max(4px, env(safe-area-inset-bottom))",
      }}
    >
      {Array.from({ length: view.columns }, (_, index) => {
        const info = sheetColumnPresentation(view, index);
        const name =
          info.name ??
          (info.fallbackName
            ? info.fallbackName
            : t("Column {{number}}", { number: index + 1 }));
        return (
          <div
            key={index}
            style={{
              minWidth: 0,
              padding: "0 4px",
              borderInlineStart: index
                ? `1px solid ${C.panelBorder}`
                : undefined,
            }}
          >
            <button
              type="button"
              aria-label={t("Column {{number}}: {{name}}", {
                number: index + 1,
                name,
              })}
              aria-current={active === index ? "page" : undefined}
              onClick={() => onSelect(index)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                minWidth: 0,
                width: "100%",
                minHeight: 44,
                border: 0,
                borderRadius: 9,
                background:
                  active === index
                    ? `color-mix(in srgb, ${accent} 14%, transparent)`
                    : "transparent",
                color: active === index ? accent : C.muted,
                cursor: "pointer",
                font: "inherit",
                fontWeight: 800,
              }}
            >
              {info.icon ? (
                <ColumnIcon icon={info.icon} size={22} />
              ) : (
                <span>{index + 1}</span>
              )}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
