import React from "react";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { fetchTreasureById } from "@/services/collectionApi";
import type { TreasureEntry } from "@/domain/types/domain";

type TreasureDrawerState = Exclude<Extract<DrawerState, { type: "viewTreasure" }>, null>;

const PROPERTY_LABELS: Record<string, string> = {
  "2H": "Two-Handed",
  F: "Finesse",
  L: "Light",
  T: "Thrown",
  V: "Versatile",
  R: "Reach",
  H: "Heavy",
  A: "Ammunition",
  LD: "Loading",
  S: "Special",
};

const DMG_TYPE_LABELS: Record<string, string> = {
  S: "Slashing",
  P: "Piercing",
  B: "Bludgeoning",
  F: "Fire",
  C: "Cold",
  L: "Lightning",
  A: "Acid",
  N: "Necrotic",
  R: "Radiant",
  T: "Thunder",
  PS: "Psychic",
  PO: "Poison",
  FO: "Force",
};

function fmtDamage(
  dmg1: string | null,
  dmg2: string | null,
  dmgType: string | null,
): { one: string | null; two: string | null; type: string | null } {
  return {
    one: dmg1 || null,
    two: dmg2 || null,
    type: DMG_TYPE_LABELS[dmgType ?? ""] ?? dmgType ?? null,
  };
}

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":
      return theme.colors.muted;
    case "uncommon":
      return "#1eff00";
    case "rare":
      return "#0070dd";
    case "very rare":
      return "#a335ee";
    case "legendary":
      return "#ff8000";
    case "artifact":
      return "#e6cc80";
    default:
      return theme.colors.muted;
  }
}

interface CompendiumItem {
  weight?: number | null;
  value?: number | null;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  modifiers?: Array<{ category: string; text: string }>;
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: "var(--fs-small)",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        color,
        border: `1px solid ${withAlpha(color, 0.27)}`,
        background: withAlpha(color, 0.12),
      }}
    >
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: 10,
        background: "rgba(255,255,255,0.035)",
        padding: "8px 10px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-tiny)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: theme.colors.muted,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--fs-subtitle)",
          fontWeight: 700,
          color: theme.colors.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function TreasureDrawer(props: {
  drawer: TreasureDrawerState;
  close: () => void;
}): DrawerContent {
  const { state } = useStore();
  const [resolvedEntry, setResolvedEntry] = React.useState<TreasureEntry | null>(null);
  const [itemData, setItemData] = React.useState<CompendiumItem | null>(null);

  const entry = React.useMemo(() => {
    const all = [...state.campaignTreasure, ...state.adventureTreasure];
    return all.find((t) => t.id === props.drawer.treasureId) ?? null;
  }, [props.drawer.treasureId, state.adventureTreasure, state.campaignTreasure]);
  const displayEntry = resolvedEntry ?? entry;

  React.useEffect(() => {
    if (!entry) {
      setResolvedEntry(null);
      return;
    }
    setResolvedEntry(entry);
    if (entry.text !== undefined && entry.text !== null) return;

    let cancelled = false;
    fetchTreasureById(entry.id)
      .then((full) => {
        if (!cancelled) setResolvedEntry(full as TreasureEntry);
      })
      .catch(() => {
        if (!cancelled) setResolvedEntry(entry);
      });

    return () => {
      cancelled = true;
    };
  }, [entry]);

  React.useEffect(() => {
    if (!displayEntry?.itemId) {
      setItemData(null);
      return;
    }
    let cancelled = false;
    api<CompendiumItem>(`/api/compendium/items/${encodeURIComponent(displayEntry.itemId)}`)
      .then((d) => {
        if (!cancelled) setItemData(d ?? null);
      })
      .catch(() => {
        if (!cancelled) setItemData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [displayEntry?.itemId]);

  if (!displayEntry) {
    return { body: <div style={{ color: theme.colors.muted }}>Item not found.</div> };
  }

  const dmg = fmtDamage(itemData?.dmg1 ?? null, itemData?.dmg2 ?? null, itemData?.dmgType ?? null);
  const propertyLabels = (itemData?.properties ?? []).map((p) => PROPERTY_LABELS[p] ?? p);
  const weight = itemData?.weight ?? null;
  const value = itemData?.value ?? null;

  const hasStats =
    dmg.one || dmg.two || dmg.type || weight != null || value != null || propertyLabels.length > 0;

  return {
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: theme.colors.text }}>
            {displayEntry.name}
          </div>
          {(displayEntry.rarity || displayEntry.type) && (
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-subtitle)", marginTop: 3 }}>
              {[displayEntry.rarity, displayEntry.type].filter(Boolean).join(" | ")}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {displayEntry.magic ? <Tag label="Magic" color={theme.colors.colorMagic} /> : null}
          {displayEntry.attunement ? (
            <Tag label="Requires Attunement" color={theme.colors.accentPrimary} />
          ) : null}
          {displayEntry.rarity ? (
            <Tag
              label={displayEntry.rarity.charAt(0).toUpperCase() + displayEntry.rarity.slice(1)}
              color={rarityColor(displayEntry.rarity)}
            />
          ) : null}
          {displayEntry.type ? <Tag label={displayEntry.type} color={theme.colors.muted} /> : null}
          {(itemData?.modifiers ?? []).map((m, i) => (
            <Tag key={i} label={m.text} color={theme.colors.colorMagic} />
          ))}
        </div>

        {hasStats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 8,
            }}
          >
            {dmg.one ? <Stat label="One-Handed Damage" value={dmg.one} /> : null}
            {dmg.two ? <Stat label="Two-Handed Damage" value={dmg.two} /> : null}
            {dmg.type ? <Stat label="Damage Type" value={dmg.type} /> : null}
            {weight != null ? <Stat label="Weight" value={`${weight} lb`} /> : null}
            {value != null ? <Stat label="Value" value={`${value} gp`} /> : null}
            {propertyLabels.length > 0 ? (
              <Stat label="Properties" value={propertyLabels.join(", ")} />
            ) : null}
          </div>
        )}

        {displayEntry.text ? (
          <div
            style={{
              color: theme.colors.text,
              lineHeight: 1.55,
              background: theme.colors.inputBg,
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: 12,
              padding: 14,
              fontSize: "var(--fs-subtitle)",
              whiteSpace: "pre-wrap",
            }}
          >
            {displayEntry.text}
          </div>
        ) : null}
      </div>
    ),
  };
}
