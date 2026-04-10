import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { CompendiumMonsterRow, AttackOverridesByMonsterId } from "@/views/CampaignView/monsterPicker/types";
import { formatCr, parseLeadingNumberLoose } from "@/views/CampaignView/monsterPicker/utils";
import { QtyStepper } from "@/views/CampaignView/monsterPicker/components/QtyStepper";

export function MonsterRow(props: {
  row: CompendiumMonsterRow;
  active: boolean;
  qty: number;
  onSelect: () => void;
  onChangeQty: (n: number) => void;
  labelBase: string;
  acRaw: string;
  acDetail: string;
  hpRaw: string;
  hpDetail: string;
  friendly: boolean;
  attackOverridesById: AttackOverridesByMonsterId;
  onSetLabelBase: (s: string) => void;
  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
}) {
  const m = props.row;
  const [showAddedFeedback, setShowAddedFeedback] = React.useState(false);
  const feedbackTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, []);

  const triggerAddedFeedback = React.useCallback(() => {
    setShowAddedFeedback(true);
    if (feedbackTimerRef.current != null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      setShowAddedFeedback(false);
      feedbackTimerRef.current = null;
    }, 500);
  }, []);

  return (
    <div
      onClick={props.onSelect}
      style={{
        height: 86,
        padding: 10,
        boxSizing: "border-box",
        borderRadius: 12,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: props.active ? withAlpha(theme.colors.accentHighlight, 0.12) : withAlpha(theme.colors.shadowColor, 0.10),
        marginBottom: 8,
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 5,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: theme.colors.text, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {`CR ${formatCr(m.cr)}`}
          {m.type ? ` - ${m.type}` : ""}
          {m.environment ? ` - ${m.environment}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <QtyStepper value={props.qty} onChange={props.onChangeQty} />
        <Button
          type="button"
          disabled={showAddedFeedback}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerAddedFeedback();

            const acNum = parseLeadingNumberLoose(props.acRaw);
            const hpNum = parseLeadingNumberLoose(props.hpRaw);

            props.onAddMonster(m.id, props.qty, {
              labelBase: props.labelBase,
              ac: Number.isFinite(acNum) ? acNum : undefined,
              acDetails: props.acDetail.trim() || undefined,
              hpMax: Number.isFinite(hpNum) ? hpNum : undefined,
              hpDetails: props.hpDetail.trim() || undefined,
              friendly: props.friendly,
              attackOverrides: props.attackOverridesById[m.id],
            });
          }}
        >
          {showAddedFeedback ? "Added" : "Add"}
        </Button>
      </div>
    </div>
  );
}
