// web-dm/src/components/SearchableSelect.tsx
//
// The one searchable-dropdown implementation for the Binder. Every relation
// picker (Leader, Domains, Race, Organization, Position, Location, Parent,
// Compendium item, Holder, Related records, ...) should use this instead of
// a native <select> or a bespoke copy of this same logic.

import { useEffect, useState } from "react";
import { Input } from "@/ui/Input";
import { theme } from "@/theme/theme";
import { EntityIcon } from "@/components/iconPicker";

export type SearchableSelectOption = {
  id: string;
  name: string;
  /** Iconify id, e.g. `game-icons:castle`. Omit for option types that don't carry an icon. */
  icon?: string | null;
  /** Short suffix shown after the name, e.g. a record type label. */
  meta?: string;
};

export function SearchableSelect(props: {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  noneLabel?: string;
  disabled?: boolean;
  maxResults?: number;
  autoFocus?: boolean;
}) {
  const selected = props.options.find((option) => option.id === props.value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(selected?.name ?? ""), [props.value, selected?.name]);

  const maxResults = props.maxResults ?? 40;
  const filtered = props.options
    .filter((option) => option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .slice(0, maxResults);

  return (
    <div style={{ position: "relative" }}>
      <Input
        id={props.id}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => {
          setOpen(false);
          setQuery(selected?.name ?? "");
        }, 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          props.onChange("");
          setOpen(true);
        }}
        placeholder={props.placeholder ?? "None"}
        disabled={props.disabled}
        autoFocus={props.autoFocus}
        autoComplete="off"
      />
      {open && !props.disabled ? (
        <div
          style={{
            position: "absolute",
            zIndex: 200,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: "auto",
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: theme.radius.control,
            background: "#0d1525",
            boxShadow: "0 12px 28px rgba(0,0,0,.65)",
          }}
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { props.onChange(""); setQuery(""); setOpen(false); }}
            style={optionStyle}
          >
            {props.noneLabel ?? "None"}
          </button>
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { props.onChange(option.id); setQuery(option.name); setOpen(false); }}
              style={{ ...optionStyle, display: "flex", alignItems: "center", gap: 8 }}
            >
              {option.icon ? <EntityIcon icon={option.icon} size={16} /> : null}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{option.name}</span>
              {option.meta ? <span style={{ color: theme.colors.muted }}> · {option.meta}</span> : null}
            </button>
          ))}
          {!filtered.length ? <div style={{ padding: "10px 12px", color: theme.colors.muted }}>No matches</div> : null}
        </div>
      ) : null}
    </div>
  );
}

const optionStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  border: 0,
  background: "transparent",
  color: theme.colors.text,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};
