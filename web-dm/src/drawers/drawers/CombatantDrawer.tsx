import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { MonsterPreview } from "@/drawers/drawers/combatant/MonsterPreview";
import { MonsterActions } from "@/views/CombatView/components/MonsterActions";
import type { AttackOverride } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type CombatantDrawerState = Exclude<Extract<DrawerState, { type: "editCombatant"; encounterId: string; combatantId: string }>, null>;

export function CombatantDrawer(props: {
  drawer: CombatantDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [label, setLabel] = React.useState("");
  const [friendly, setFriendly] = React.useState(false);
  const [ac, setAc] = React.useState("");
  const [hpMax, setHpMax] = React.useState("");
  const [hpCur, setHpCur] = React.useState("");
  const [baseMonster, setBaseMonster] = React.useState<MonsterDetail | null>(null);
  const [attackOverrides, setAttackOverrides] = React.useState<Record<string, AttackOverride>>({});

  React.useEffect(() => {
    const d = props.drawer;
    const c = state.combatants.find((x) => x.id === d.combatantId);
    setLabel(c ? String(c.label) : "");
    setFriendly(Boolean(c?.friendly));
    setAc(c?.ac != null ? String(c.ac) : "");
    setHpMax(c?.hpMax != null ? String(c.hpMax) : "");
    setHpCur(c?.hpCurrent != null ? String(c.hpCurrent) : "");
    setAttackOverrides((c?.attackOverrides as Record<string, AttackOverride>) ?? {});

    if (c && c.baseType === "monster" && c.baseId) {
    api<MonsterDetail>(`/api/compendium/monsters/${c.baseId}`)
        .then((m) => setBaseMonster(m))
        .catch(() => setBaseMonster(null));
    } else {
      setBaseMonster(null);
    }
  }, [props.drawer, state.combatants]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    await api(
      `/api/encounters/${d.encounterId}/combatants/${d.combatantId}`,
      jsonInit("PUT", {
        label,
        friendly,
        ac: ac !== "" ? Number(ac) : undefined,
        hpMax: hpMax !== "" ? Number(hpMax) : undefined,
        hpCurrent: hpCur !== "" ? Number(hpCur) : undefined,
        attackOverrides
      })
    );
    await props.refreshEncounter(d.encounterId);
    props.close();
  }, [ac, friendly, hpCur, hpMax, label, props]);

  return {
    body: (
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 8 }}>Label (instance only)</div>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ color: theme.colors.muted, marginBottom: 6 }}>AC</div>
            <Input value={ac} onChange={(e) => setAc(e.target.value)} placeholder="10" />
          </div>
          <div>
            <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Max HP</div>
            <Input value={hpMax} onChange={(e) => setHpMax(e.target.value)} placeholder="10" />
          </div>
        </div>

        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Current HP</div>
          <Input value={hpCur} onChange={(e) => setHpCur(e.target.value)} placeholder="10" />
        </div>

        <label style={{ color: theme.colors.text, display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={friendly} onChange={(e) => setFriendly(e.target.checked)} />
          Friendly
        </label>

        {baseMonster ? (
  <>
    <MonsterActions
      monster={baseMonster}
      attackOverrides={attackOverrides}
      onChangeAttack={(name, patch) =>
        setAttackOverrides((prev) => ({
          ...prev,
          [name]: { ...(prev[name] ?? {}), ...patch }
        }))
      }
    />
  </>
) : null}
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
