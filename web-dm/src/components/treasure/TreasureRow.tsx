import { CollectionRow, QuantityStepper, Tag } from "@beholden/shared/ui";
import { IconPlayer } from "@/icons";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { RarityDot } from "@/views/CampaignView/components/ItemPickerModalParts";
import type { TreasureEntry } from "@/domain/types/domain";

export function TreasureRow({ item: t, onClick, onAward, updateQty, remove }: {
  item: TreasureEntry;
  onClick?: () => void;
  onAward: () => void;
  updateQty: (id: string, quantity: number) => void;
  remove: (id: string) => void;
}) {
  return (
    <CollectionRow
      onClick={onClick}
      borderColor={theme.colors.panelBorder}
      padding="6px 4px"
      main={(
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "var(--fs-subtitle)", color: theme.colors.text }}>
            {t.rarity ? <RarityDot rarity={t.rarity} /> : null}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{t.name}</span>
            {t.magic ? <Tag label="Magic" color={theme.colors.colorMagic} /> : null}
          </div>
          {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).length > 0 ? (
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginTop: 1 }}>
              {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).join(" • ")}
            </div>
          ) : null}
        </>
      )}
      trailing={(
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <IconButton
            title="Award to player"
            variant="ghost"
            size="sm"
            onClick={onAward}
          >
            <IconPlayer size={15} />
          </IconButton>
          <QuantityStepper
            value={(t.qty ?? 1) > 1 ? t.qty : null}
            valuePrefix="x"
            onDecrement={(t.qty ?? 1) > 1 ? () => updateQty(t.id, Math.max(1, (t.qty ?? 1) - 1)) : undefined}
            decrementDisabled={(t.qty ?? 1) <= 1}
            onIncrement={() => updateQty(t.id, (t.qty ?? 1) + 1)}
            theme={{
              buttonBackground: "rgba(255,255,255,0.05)",
              buttonBorder: "rgba(255,255,255,0.12)",
              buttonColor: "rgba(255,255,255,0.7)",
              valueColor: theme.colors.muted,
              buttonSize: 22,
              borderRadius: 6,
              fontSize: "var(--fs-body)",
              valueMinWidth: 18,
            }}
          />
          <button
            type="button"
            title="Remove"
            onClick={() => remove(t.id)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,0.55)", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
    />
  );
}
