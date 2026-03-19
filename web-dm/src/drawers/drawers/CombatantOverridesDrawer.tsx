import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";

type OverridesDrawerState = Exclude<Extract<DrawerState, { type: "combatantOverrides"; encounterId: string; combatantId: string }>, null>;

function digitsOrEmpty(v: string) {
  return v.replace(/[^0-9-]/g, "");
}

export function CombatantOverridesDrawer(props: {
  drawer: OverridesDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [initiative, setInitiative] = React.useState("");
  const [color, setColor] = React.useState("");
  const [friendly, setFriendly] = React.useState(false);
  const [acBonus, setAcBonus] = React.useState("0");
  const [tempHp, setTempHp] = React.useState("0");
  const [hpMaxOverride, setHpMaxOverride] = React.useState("");

  const combatant = React.useMemo(
    () => state.combatants.find((x) => x.id === props.drawer.combatantId),
    [props.drawer.combatantId, state.combatants]
  );

  React.useEffect(() => {
if (!combatant) return;
  setInitiative(combatant.initiative != null ? String(combatant.initiative) : "");
  setColor(String(combatant.color ?? ""));
  setFriendly(Boolean(combatant.friendly));
  const o = combatant.overrides;
  setAcBonus(String(o.acBonus ?? 0));
  setTempHp(String(o.tempHp ?? 0));
  setHpMaxOverride(o.hpMaxOverride != null ? String(o.hpMaxOverride) : "");
  }, [combatant]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    if (!combatant) { props.close(); return; }
    const initVal = initiative.trim() === "" ? null : Number(initiative);
   const nextOverrides = {
    ...combatant.overrides,
      acBonus: Number(acBonus) || 0,
      tempHp: Number(tempHp) || 0,
      hpMaxOverride: hpMaxOverride.trim() === "" ? null : Number(hpMaxOverride)
    };
    await api(
      `/api/encounters/${d.encounterId}/combatants/${d.combatantId}`,
      jsonInit("PUT", {
        initiative: initVal,
        color: color || null,
        friendly,
        overrides: nextOverrides
      })
    );
    await props.refreshEncounter(d.encounterId);
    props.close();
  }, [acBonus, color, combatant, friendly, hpMaxOverride, initiative, props, tempHp]);

  const showMonsterFields = combatant?.baseType === "monster";

  return {
    body: (
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Initiative</div>
          <Input value={initiative} onChange={(e) => setInitiative(digitsOrEmpty(e.target.value))} placeholder="0" />
        </div>

        {showMonsterFields ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Friendly</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button variant={friendly ? "primary" : "ghost"} onClick={() => setFriendly(true)} style={{ padding: "6px 10px" }}>
                  Friendly
                </Button>
                <Button variant={!friendly ? "danger" : "ghost"} onClick={() => setFriendly(false)} style={{ padding: "6px 10px" }}>
                  Hostile
                </Button>
              </div>
            </div>
            <div>
              <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Color Label</div>
              <ColorChips value={color} onChange={setColor} />
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ color: theme.colors.muted, marginBottom: 6 }}>AC bonus</div>
            <Input value={acBonus} onChange={(e) => setAcBonus(digitsOrEmpty(e.target.value))} placeholder="0" inputMode="numeric" />
          </div>
          <div>
            <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Temp HP</div>
            <Input value={tempHp} onChange={(e) => setTempHp(digitsOrEmpty(e.target.value))} placeholder="0" inputMode="numeric" />
          </div>
        </div>

        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>HP Modifier</div>
          <Input value={hpMaxOverride} onChange={(e) => setHpMaxOverride(digitsOrEmpty(e.target.value))} placeholder="0" inputMode="numeric" />
        </div>
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={props.close}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </div>
    )
  };
}

const TAG_PALETTE = [
  "#26c6da", "#7dc56d", "#ff5d5d", "#f4d35e", "#ff9e4a", "#c77dff", "#ffffff",
];

function ColorChips(props: { value: string; onChange: (v: string) => void }) {
  const options = TAG_PALETTE;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => props.onChange(props.value === c ? "" : c)}
          title={c}
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: c,
            boxShadow: props.value === c ? `0 0 0 2px ${theme.colors.accentHighlight}` : "none",
            cursor: "pointer"
          }}
        />
      ))}
    </div>
  );
}
