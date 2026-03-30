import * as React from "react";
import { theme } from "@/theme/theme";
import { Input } from "@/ui/Input";
import { splitLeadingNumberAndDetail } from "@/lib/parse/statDetails";
import type { AttackOverridesByMonsterId } from "@/views/CampaignView/monsterPicker/types";
import { MonsterStatblock } from "@/views/CampaignView/monsterPicker/statblock/MonsterStatblock";

function cleanDetail(detail: string): string {
  const d = String(detail ?? "").trim();
  if (!d) return "";
  // If the detail already has parentheses (e.g. "(10d8)"), strip them so we don't render "((10d8))".
  if (d.startsWith("(") && d.endsWith(")") && d.length > 2) return d.slice(1, -1).trim();
  return d;
}

export function MonsterPickerDetailPane(props: {
  selectedMonsterId: string | null;
  monster: any | null;
  label: string;
  onChangeLabel: (v: string) => void;
  ac: string;
  acDetail: string;
  hp: string;
  hpDetail: string;
  friendly: boolean;
  onChangeAc: (numText: string, detail: string) => void;
  onChangeHp: (numText: string, detail: string) => void;
  onChangeFriendly: (v: boolean) => void;
  attackOverrides: AttackOverridesByMonsterId;
  onChangeAttack: (actionName: string, patch: { toHit?: number; damage?: string; damageType?: string }) => void;
}) {
  const id = props.selectedMonsterId;
  const disabled = !id;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div style={{ paddingBottom: 10 }}>
        <Input value={props.label ?? ""} onChange={(e) => props.onChangeLabel(e.target.value)} placeholder="Label" disabled={disabled} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, paddingBottom: 10 }}>
        <div style={{ color: theme.colors.text, display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>
            Armor Class{cleanDetail(props.acDetail) ? ` (${cleanDetail(props.acDetail)})` : ""}:
          </span>
          <Input
            value={props.ac ?? ""}
            onChange={(e) => {
              const next = splitLeadingNumberAndDetail(e.target.value);
              props.onChangeAc(next.numText, next.detail);
            }}
            placeholder="AC"
            disabled={disabled}
          />
        </div>

        <div style={{ color: theme.colors.text, display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>
            Hit Points{cleanDetail(props.hpDetail) ? ` (${cleanDetail(props.hpDetail)})` : ""}:
          </span>
          <Input
            value={props.hp ?? ""}
            onChange={(e) => {
              const next = splitLeadingNumberAndDetail(e.target.value);
              props.onChangeHp(next.numText, next.detail);
            }}
            placeholder="HP"
            disabled={disabled}
          />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12 }}>
        <input
          type="checkbox"
          checked={props.friendly}
          onChange={(e) => props.onChangeFriendly(e.target.checked)}
          disabled={disabled}
        />
        <span style={{ color: theme.colors.text, fontWeight: 700 }}>Friendly</span>
      </label>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingRight: 6 }}>
        <MonsterStatblock
          monster={props.monster}
          hideSummary
          attackOverrides={id ? props.attackOverrides[id] : undefined}
          onChangeAttack={props.onChangeAttack}
        />
      </div>
    </div>
  );
}
