import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import { useConfirm } from "@/confirm/ConfirmContext";
import type { DrawerContent } from "@/drawers/types";
import { MonsterPreview } from "@/drawers/drawers/combatant/MonsterPreview";

type INpcDrawerState = Exclude<Extract<DrawerState, { type: "editINpc"; inpcId: string }>, null>;

export function INpcDrawer(props: {
  drawer: INpcDrawerState;
  close: () => void;
  refreshCampaign: (cid: string) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const confirm = useConfirm();
  const inpc = React.useMemo(() => state.inpcs.find((i) => i.id === props.drawer.inpcId) ?? null, [state.inpcs, props.drawer.inpcId]);

  const [name, setName] = React.useState("");
  const [friendly, setFriendly] = React.useState<"true" | "false">("true");
  const [hpMax, setHpMax] = React.useState("10");
  const [hpCurrent, setHpCurrent] = React.useState("10");
  const [hpDetails, setHpDetails] = React.useState("");
  const [ac, setAc] = React.useState("10");
  const [acDetails, setAcDetails] = React.useState("");
  const [baseMonster, setBaseMonster] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!inpc) return;
    setName(inpc.name ?? "");
    setFriendly(inpc.friendly ? "true" : "false");
    setHpMax(String(inpc.hpMax ?? 10));
    setHpCurrent(String(inpc.hpCurrent ?? inpc.hpMax ?? 10));
    setHpDetails(String(inpc.hpDetails ?? ""));
    setAc(String(inpc.ac ?? 10));
    setAcDetails(String(inpc.acDetails ?? ""));

    if (inpc.monsterId) {
      api<any>(`/api/compendium/monsters/${inpc.monsterId}`)
        .then((m) => setBaseMonster(m))
        .catch(() => setBaseMonster(null));
    } else {
      setBaseMonster(null);
    }
  }, [inpc]);

  const submit = React.useCallback(async () => {
    if (!inpc) return;
    await api(
      `/api/inpcs/${inpc.id}`,
      jsonInit("PUT", {
        name: name.trim() || inpc.name,
        friendly: friendly === "true",
        hpMax: Number(hpMax) || 1,
        hpCurrent: Math.max(0, Number(hpCurrent) || 0),
        hpDetails: hpDetails.trim() || null,
        ac: Number(ac) || 10,
        acDetails: acDetails.trim() || null
      })
    );
    await props.refreshCampaign(state.selectedCampaignId);
    props.close();
  }, [inpc, name, friendly, hpMax, hpCurrent, hpDetails, ac, acDetails, props, state.selectedCampaignId]);

  const deleteINpc = React.useCallback(async () => {
    if (!inpc) return;
    if (
      !(await confirm({
        title: "Delete iNPC",
        message: "Delete this iNPC? This cannot be undone.",
        intent: "danger"
      }))
    )
      return;
    await api(`/api/inpcs/${inpc.id}`, { method: "DELETE" });
    await props.refreshCampaign(state.selectedCampaignId);
    props.close();
  }, [confirm, inpc, props, state.selectedCampaignId]);

  return {
    body: !inpc ? (
      <div style={{ color: "var(--muted)" }}>iNPC not found.</div>
    ) : (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="iNPC name" />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Friendly</div>
          <Select value={friendly} onChange={(e) => setFriendly(e.target.value as any)}>
            <option value="true">Friendly</option>
            <option value="false">Hostile</option>
          </Select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>HP Max</div>
            <Input value={hpMax} onChange={(e) => setHpMax(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>HP Current</div>
            <Input value={hpCurrent} onChange={(e) => setHpCurrent(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>HP Details</div>
          <Input value={hpDetails} onChange={(e) => setHpDetails(e.target.value)} placeholder="(25d8+25)" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>AC</div>
            <Input value={ac} onChange={(e) => setAc(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>AC Details</div>
            <Input value={acDetails} onChange={(e) => setAcDetails(e.target.value)} placeholder="(natural armor)" />
          </div>
        </div>

        {/* Read-only monster stat block (attacks/actions/etc.) */}
        {baseMonster ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ color: theme.colors.muted, marginBottom: 8, fontWeight: 800 }}>Monster Details</div>
            <MonsterPreview monster={baseMonster} />
          </div>
        ) : null}
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Button variant="danger" onClick={deleteINpc} disabled={!inpc}>
            Delete
          </Button>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={props.close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!inpc}>
            Save
          </Button>
        </div>
      </div>
    )
  };
}
