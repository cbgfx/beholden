import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { api, jsonInit } from "@/services/api";
import { useStore } from "@/store";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { SectionTitle } from "@/ui/SectionTitle";

type CompendiumFacility = {
  id: string;
  name: string;
  key: string;
  type: "basic" | "special";
  minimumLevel: number;
  prerequisite: string | null;
  orders: string[];
  space: string | null;
  hirelings: number | null;
  allowMultiple: boolean;
  description: string | null;
};

type BastionFacility = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
  definition: CompendiumFacility | null;
};

type Bastion = {
  id: string;
  campaignId: string;
  name: string;
  active: boolean;
  walled: boolean;
  defendersArmed: number;
  defendersUnarmed: number;
  assignedPlayerIds: string[];
  assignedCharacterIds: string[];
  assignedPlayers?: Array<{ id: string; userId: string | null; level: number; characterId: string | null; characterName: string }>;
  notes: string;
  maintainOrder: boolean;
  facilities: BastionFacility[];
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
  hirelingsTotal?: number;
};

type BastionsResponse = {
  ok: boolean;
  role: "dm" | "player";
  currentUserPlayerIds: string[];
  bastions: Bastion[];
};

type BastionCompendiumResponse = {
  ok: boolean;
  facilities: CompendiumFacility[];
  orders: Array<{ id: string; name: string; key: string; sort: number }>;
};

function specialSlotsForLevel(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 2;
  return 0;
}

function normalizeOrder(value: string | null | undefined): string | null {
  const next = String(value ?? "").trim();
  return next.length > 0 ? next : null;
}

function orderListWithMaintain(orders: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const order of [...orders, "Maintain"]) {
    const key = order.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(order);
  }
  return out;
}

export function BastionsModal(props: { isOpen: boolean; onClose: () => void }) {
  const { state } = useStore();
  const campaignId = state.selectedCampaignId;
  const players = state.players;

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");

  const [compendium, setCompendium] = React.useState<BastionCompendiumResponse | null>(null);
  const [bastions, setBastions] = React.useState<Bastion[]>([]);
  const [selectedBastionId, setSelectedBastionId] = React.useState<string | null>(null);
  const [activePlayerFacilityId, setActivePlayerFacilityId] = React.useState<string | null>(null);
  const [overviewExpanded, setOverviewExpanded] = React.useState(true);
  const [facilitiesExpanded, setFacilitiesExpanded] = React.useState(true);
  const autosaveTimerRef = React.useRef<number | null>(null);
  const autosaveInFlightRef = React.useRef(false);
  const queuedAutosaveRef = React.useRef<{ bastion: Bastion; sig: string } | null>(null);
  const savedSignaturesRef = React.useRef<Map<string, string>>(new Map());
  const selectedBastionRef = React.useRef<Bastion | null>(null);

  const selectedBastion = React.useMemo(
    () => bastions.find((bastion) => bastion.id === selectedBastionId) ?? null,
    [bastions, selectedBastionId],
  );
  const selectedAssignedKey = React.useMemo(
    () => selectedBastion?.assignedPlayerIds.join(",") ?? "",
    [selectedBastion?.assignedPlayerIds],
  );

  const facilitiesByKey = React.useMemo(() => {
    const map = new Map<string, CompendiumFacility>();
    for (const facility of compendium?.facilities ?? []) map.set(facility.key, facility);
    return map;
  }, [compendium?.facilities]);

  function savePayloadForBastion(bastion: Bastion) {
    return {
      name: bastion.name,
      active: bastion.active,
      walled: bastion.walled,
      defendersArmed: Math.max(0, Math.floor(Number(bastion.defendersArmed ?? 0))),
      defendersUnarmed: Math.max(0, Math.floor(Number(bastion.defendersUnarmed ?? 0))),
      assignedPlayerIds: bastion.assignedPlayerIds,
      assignedCharacterIds: bastion.assignedCharacterIds,
      notes: bastion.notes,
      maintainOrder: bastion.maintainOrder,
      facilities: bastion.facilities.map((facility) => ({
        id: facility.id,
        facilityKey: facility.facilityKey,
        source: facility.source,
        ownerPlayerId: facility.ownerPlayerId,
        order: normalizeOrder(facility.order),
        notes: facility.notes,
      })),
    };
  }

  function saveSignatureForBastion(bastion: Bastion): string {
    return JSON.stringify(savePayloadForBastion(bastion));
  }

  async function load(preferredBastionId?: string | null) {
    if (!props.isOpen || !campaignId) return;
    setLoading(true);
    setMessage("");
    try {
      const [compendiumData, bastionData] = await Promise.all([
        api<BastionCompendiumResponse>("/api/compendium/bastions"),
        api<BastionsResponse>(`/api/campaigns/${campaignId}/bastions`),
      ]);
      setCompendium(compendiumData);
      setBastions(bastionData.bastions);
      savedSignaturesRef.current = new Map(
        bastionData.bastions.map((bastion) => [bastion.id, saveSignatureForBastion(bastion)]),
      );
      setSelectedBastionId((prev) => {
        if (preferredBastionId && bastionData.bastions.some((bastion) => bastion.id === preferredBastionId)) return preferredBastionId;
        if (prev && bastionData.bastions.some((bastion) => bastion.id === prev)) return prev;
        return bastionData.bastions[0]?.id ?? null;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load Bastions.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!props.isOpen) return;
    void load();
  }, [props.isOpen, campaignId]);

  React.useEffect(() => {
    selectedBastionRef.current = selectedBastion;
  }, [selectedBastion]);

  React.useEffect(() => {
    if (!selectedBastion) {
      setActivePlayerFacilityId(null);
      return;
    }
    setActivePlayerFacilityId((prev) => (prev && selectedBastion.assignedPlayerIds.includes(prev) ? prev : null));
  }, [selectedBastionId, selectedAssignedKey]);

  function updateSelectedDraft(mutator: (bastion: Bastion) => Bastion) {
    if (!selectedBastion) return;
    setBastions((prev) => prev.map((bastion) => (bastion.id === selectedBastion.id ? mutator(bastion) : bastion)));
  }

  function selectedLevelFromAssignments(bastion: Bastion): number {
    return Math.max(
      1,
      ...players.filter((player) => bastion.assignedPlayerIds.includes(player.id)).map((player) => player.level),
      1,
    );
  }

  function selectedSpecialUsage(bastion: Bastion): number {
    return bastion.facilities.filter((facility) => {
      const def = facility.definition ?? facilitiesByKey.get(facility.facilityKey);
      return def?.type === "special" && facility.source !== "dm_extra";
    }).length;
  }

  function selectedSpecialUsageForPlayer(bastion: Bastion, playerId: string): number {
    return bastion.facilities.filter((facility) => {
      if (facility.source !== "player" || facility.ownerPlayerId !== playerId) return false;
      const def = facility.definition ?? facilitiesByKey.get(facility.facilityKey);
      return def?.type === "special";
    }).length;
  }

  function selectedSpecialSlotsForPlayer(bastion: Bastion, playerId: string): number {
    const player = players.find((entry) => entry.id === playerId);
    return specialSlotsForLevel(player?.level ?? 1);
  }

  function selectedHirelingsTotal(bastion: Bastion): number {
    return bastion.facilities.reduce((sum, facility) => {
      const def = facility.definition ?? facilitiesByKey.get(facility.facilityKey);
      return sum + (def?.hirelings ?? 0);
    }, 0);
  }

  function availableFacilityOptions(bastion: Bastion, source: "player" | "dm_extra", ownerPlayerId?: string) {
    const level = selectedLevelFromAssignments(bastion);
    const existingCounts = new Map<string, number>();
    for (const facility of bastion.facilities) {
      existingCounts.set(facility.facilityKey, (existingCounts.get(facility.facilityKey) ?? 0) + 1);
    }

    return (compendium?.facilities ?? []).filter((facility) => {
      const ownerLevel = ownerPlayerId ? (players.find((entry) => entry.id === ownerPlayerId)?.level ?? 1) : level;
      if (facility.type === "special" && source !== "dm_extra" && facility.minimumLevel > ownerLevel) return false;
      if (source === "player" && ownerPlayerId && facility.type === "special") {
        const used = selectedSpecialUsageForPlayer(bastion, ownerPlayerId);
        const slots = selectedSpecialSlotsForPlayer(bastion, ownerPlayerId);
        if (used >= slots) return false;
      }
      if (!facility.allowMultiple && (existingCounts.get(facility.key) ?? 0) > 0) return false;
      return true;
    });
  }

  async function createBastion() {
    if (!campaignId) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await api<{ ok: boolean; id: string }>(`/api/campaigns/${campaignId}/bastions`, jsonInit("POST", {
        name: "New Bastion",
        active: false,
        assignedPlayerIds: [],
        facilities: [],
      }));
      await load(result.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to grant Bastion.");
    } finally {
      setSaving(false);
    }
  }

  const persistBastion = React.useCallback(async (bastion: Bastion, sig: string) => {
    if (!campaignId) return;
    if (autosaveInFlightRef.current) {
      queuedAutosaveRef.current = { bastion, sig };
      return;
    }
    autosaveInFlightRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      await api(`/api/campaigns/${campaignId}/bastions/${bastion.id}`, jsonInit("PUT", savePayloadForBastion(bastion)));
      savedSignaturesRef.current.set(bastion.id, sig);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save Bastion.");
    } finally {
      autosaveInFlightRef.current = false;
      const queued = queuedAutosaveRef.current;
      queuedAutosaveRef.current = null;
      if (queued) {
        void persistBastion(queued.bastion, queued.sig);
      } else {
        setSaving(false);
      }
    }
  }, [campaignId]);

  async function deleteSelectedBastion() {
    if (!campaignId || !selectedBastion) return;
    if (!window.confirm(`Delete ${selectedBastion.name}?`)) return;
    setSaving(true);
    setMessage("");
    try {
      await api(`/api/campaigns/${campaignId}/bastions/${selectedBastion.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete Bastion.");
    } finally {
      setSaving(false);
    }
  }

  function toggleAssignedPlayer(playerId: string) {
    updateSelectedDraft((bastion) => ({
      ...bastion,
      assignedPlayerIds: bastion.assignedPlayerIds.includes(playerId)
        ? bastion.assignedPlayerIds.filter((id) => id !== playerId)
        : [...bastion.assignedPlayerIds, playerId],
    }));
  }

  function chipButtonStyle(active: boolean): React.CSSProperties {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 34,
      padding: "0 10px",
      borderRadius: 999,
      border: `1px solid ${active ? withAlpha(theme.colors.accentPrimary, 0.7) : theme.colors.panelBorder}`,
      background: active ? withAlpha(theme.colors.accentPrimary, 0.16) : "rgba(255,255,255,0.03)",
      color: active ? theme.colors.text : theme.colors.muted,
      cursor: "pointer",
      fontSize: "var(--fs-small)",
      fontWeight: 700,
      whiteSpace: "nowrap",
    };
  }

  function addFacility(source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) {
    if (!selectedBastion || !facilityKey) return;
    const definition = facilitiesByKey.get(facilityKey);
    if (!definition) return;
    if (source === "player" && !ownerPlayerId) return;
    updateSelectedDraft((bastion) => ({
      ...bastion,
      facilities: [
        ...bastion.facilities,
        {
          id: `draft:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          facilityKey,
          source,
          ownerPlayerId: source === "player" ? ownerPlayerId ?? null : null,
          order: null,
          notes: "",
          definition,
        },
      ],
    }));
  }

  function updateFacility(facilityId: string, patch: Partial<BastionFacility>) {
    updateSelectedDraft((bastion) => ({
      ...bastion,
      facilities: bastion.facilities.map((facility) => (facility.id === facilityId ? { ...facility, ...patch } : facility)),
    }));
  }

  function removeFacility(facilityId: string) {
    updateSelectedDraft((bastion) => ({
      ...bastion,
      facilities: bastion.facilities.filter((facility) => facility.id !== facilityId),
    }));
  }

  React.useEffect(() => {
    if (!props.isOpen || !campaignId || !selectedBastion) return;
    const sig = saveSignatureForBastion(selectedBastion);
    if (savedSignaturesRef.current.get(selectedBastion.id) === sig) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistBastion(selectedBastion, sig);
    }, 350);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [props.isOpen, campaignId, selectedBastion, persistBastion]);

  React.useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const current = selectedBastionRef.current;
      if (!current) return;
      const sig = saveSignatureForBastion(current);
      if (savedSignaturesRef.current.get(current.id) === sig) return;
      void persistBastion(current, sig);
    };
  }, [persistBastion]);

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Bastions" width={1200} height={760}>
      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "320px 1fr", background: "transparent" }}>
        <div style={{ borderRight: `1px solid ${theme.colors.panelBorder}`, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {!campaignId ? (
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>Select a campaign to manage Bastions.</div>
          ) : (
            <>
              <div style={{ marginTop: 6, fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Bastions ({bastions.length})</span>
                <Button onClick={() => void createBastion()} disabled={saving}>+</Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {bastions.map((bastion) => (
                  <button
                    key={bastion.id}
                    onClick={() => setSelectedBastionId(bastion.id)}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${selectedBastionId === bastion.id ? withAlpha(theme.colors.accentPrimary, 0.55) : theme.colors.panelBorder}`,
                      background: selectedBastionId === bastion.id ? withAlpha(theme.colors.accentPrimary, 0.12) : "rgba(255,255,255,0.03)",
                      color: theme.colors.text,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "var(--fs-small)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bastion.name}</span>
                      <span style={{ fontSize: "var(--fs-tiny)", color: bastion.active ? theme.colors.green : theme.colors.muted, fontWeight: 700 }}>
                        {bastion.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: theme.colors.muted }}>
                      Slots {bastion.specialSlotsUsed}/{bastion.specialSlots}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: 14, overflowY: "auto" }}>
          {loading ? <div style={{ color: theme.colors.muted }}>Loading...</div> : null}
          {!loading && selectedBastion ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                <Input value={selectedBastion.name} onChange={(e) => updateSelectedDraft((bastion) => ({ ...bastion, name: e.target.value }))} />
                <button
                  type="button"
                  style={chipButtonStyle(selectedBastion.active)}
                  onClick={() => updateSelectedDraft((bastion) => ({ ...bastion, active: !bastion.active }))}
                >
                  Active
                </button>
                <button
                  type="button"
                  style={chipButtonStyle(selectedBastion.maintainOrder)}
                  onClick={() => updateSelectedDraft((bastion) => {
                    const nextMaintain = !bastion.maintainOrder;
                    return {
                      ...bastion,
                      maintainOrder: nextMaintain,
                      facilities: nextMaintain
                        ? bastion.facilities.map((facility) => (
                          facility.source === "player" ? { ...facility, order: "Maintain" } : facility
                        ))
                        : bastion.facilities,
                    };
                  })}
                >
                  Maintain
                </button>
              </div>

              <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionTitle
                  color={theme.colors.colorMagic}
                  collapsed={!overviewExpanded}
                  onToggle={() => setOverviewExpanded((prev) => !prev)}
                >
                  Overview
                </SectionTitle>
                {overviewExpanded ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                        Assigned Players
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {players.map((player) => {
                          const selected = selectedBastion.assignedPlayerIds.includes(player.id);
                          return (
                            <button
                              key={player.id}
                              type="button"
                              onClick={() => toggleAssignedPlayer(player.id)}
                              style={chipButtonStyle(selected)}
                              title={`${player.characterName || "Unnamed"} Lv ${player.level}`}
                            >
                              <span>{player.characterName || "Unnamed"}</span>
                              <span style={{ color: theme.colors.muted, fontWeight: 600 }}>Lv {player.level}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                        Slot Usage
                      </div>
                      <div style={{ fontSize: "var(--fs-body)", color: theme.colors.text, fontWeight: 700 }}>
                        Special Slots: {selectedSpecialUsage(selectedBastion)} / {selectedBastion.specialSlots}
                      </div>
                      <div style={{ marginTop: 6, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
                        Hirelings: {selectedHirelingsTotal(selectedBastion)}
                      </div>
                      <div style={{ marginTop: 4, fontSize: "var(--fs-small)", color: theme.colors.muted, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        Bastion Defenders: {Math.max(0, selectedBastion.defendersArmed + selectedBastion.defendersUnarmed)}
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                          Armed
                          <input
                            type="number"
                            min={0}
                            value={selectedBastion.defendersArmed}
                            onChange={(e) => {
                              const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                              updateSelectedDraft((bastion) => ({ ...bastion, defendersArmed: next }));
                            }}
                            style={{
                              width: 72,
                              borderRadius: 8,
                              border: `1px solid ${theme.colors.panelBorder}`,
                              background: "rgba(255,255,255,0.03)",
                              color: theme.colors.text,
                              padding: "6px 8px",
                              fontSize: "var(--fs-small)",
                              boxSizing: "border-box",
                            }}
                          />
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                          Unarmed
                          <input
                            type="number"
                            min={0}
                            value={selectedBastion.defendersUnarmed}
                            onChange={(e) => {
                              const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                              updateSelectedDraft((bastion) => ({ ...bastion, defendersUnarmed: next }));
                            }}
                            style={{
                              width: 72,
                              borderRadius: 8,
                              border: `1px solid ${theme.colors.panelBorder}`,
                              background: "rgba(255,255,255,0.03)",
                              color: theme.colors.text,
                              padding: "6px 8px",
                              fontSize: "var(--fs-small)",
                              boxSizing: "border-box",
                            }}
                          />
                        </label>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => updateSelectedDraft((bastion) => ({ ...bastion, walled: !bastion.walled }))}
                          style={chipButtonStyle(Boolean(selectedBastion.walled))}
                        >
                          Walled
                        </button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                        Bastion Notes
                      </div>
                      <textarea
                        value={selectedBastion.notes}
                        onChange={(e) => updateSelectedDraft((bastion) => ({ ...bastion, notes: e.target.value }))}
                        placeholder="Bastion notes"
                        style={{
                          width: "100%",
                          minHeight: 112,
                          borderRadius: 8,
                          border: `1px solid ${theme.colors.panelBorder}`,
                          background: "rgba(255,255,255,0.03)",
                          color: theme.colors.text,
                          padding: 8,
                          boxSizing: "border-box",
                          fontSize: "var(--fs-small)",
                          fontFamily: "inherit",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionTitle
                  color={theme.colors.colorMagic}
                  collapsed={!facilitiesExpanded}
                  onToggle={() => setFacilitiesExpanded((prev) => !prev)}
                >
                  Facilities
                </SectionTitle>
                {facilitiesExpanded ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <FacilityEditor
                      options={
                        activePlayerFacilityId
                          ? availableFacilityOptions(selectedBastion, "player", activePlayerFacilityId)
                          : availableFacilityOptions(selectedBastion, "dm_extra")
                      }
                      label="Facilities"
                      source={activePlayerFacilityId ? "player" : "dm_extra"}
                      ownerPlayerId={activePlayerFacilityId ?? undefined}
                      rows={
                        activePlayerFacilityId
                          ? selectedBastion.facilities.filter((facility) => facility.source === "player" && facility.ownerPlayerId === activePlayerFacilityId)
                          : selectedBastion.facilities.filter((facility) => facility.source === "dm_extra")
                      }
                      onAdd={addFacility}
                      onUpdate={updateFacility}
                      onRemove={removeFacility}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePlayerFacilityId(null);
                          }}
                          style={chipButtonStyle(!activePlayerFacilityId)}
                        >
                          Granted
                        </button>
                        {selectedBastion.assignedPlayerIds.map((playerId) => {
                          const player = players.find((entry) => entry.id === playerId);
                          const used = selectedSpecialUsageForPlayer(selectedBastion, playerId);
                          const slots = selectedSpecialSlotsForPlayer(selectedBastion, playerId);
                          return (
                            <button
                              key={`player-toggle:${playerId}`}
                              type="button"
                              onClick={() => {
                                setActivePlayerFacilityId((prev) => (prev === playerId ? null : playerId));
                              }}
                              style={chipButtonStyle(activePlayerFacilityId === playerId)}
                            >
                              <span>{player?.characterName || "Unnamed"}</span>
                              <span style={{ color: theme.colors.muted, fontWeight: 600 }}>{used}/{slots}</span>
                            </button>
                          );
                        })}
                      </div>
                    </FacilityEditor>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Button variant="ghost" onClick={() => void deleteSelectedBastion()} disabled={saving}>Delete Bastion</Button>
                <div />
              </div>
            </div>
          ) : null}

          {!loading && !selectedBastion && campaignId ? (
            <div style={{ color: theme.colors.muted }}>Grant a Bastion to begin.</div>
          ) : null}

          {message ? (
            <div style={{ marginTop: 10, color: message.toLowerCase().includes("fail") || message.toLowerCase().includes("invalid") ? theme.colors.red : theme.colors.muted }}>
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function FacilityEditor(props: {
  rows: BastionFacility[];
  label: string;
  source: "player" | "dm_extra";
  ownerPlayerId?: string;
  options: CompendiumFacility[];
  onAdd: (source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) => void;
  onUpdate: (facilityId: string, patch: Partial<BastionFacility>) => void;
  onRemove: (facilityId: string) => void;
  showAddControls?: boolean;
  children?: React.ReactNode;
}) {
  const [addKey, setAddKey] = React.useState("");
  const rows = props.rows;
  const showAddControls = props.showAddControls !== false;

  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {props.label}
        </div>
        {showAddControls ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Select
              value={addKey}
              onChange={(e) => setAddKey(e.target.value)}
              style={{ minWidth: 260 }}
            >
              <option value="">Add facility...</option>
              {props.options.map((facility) => (
                <option key={facility.key} value={facility.key}>
                  {facility.name} ({facility.type}, lvl {facility.minimumLevel})
                </option>
              ))}
            </Select>
            <Button
              onClick={() => {
                if (!addKey) return;
                props.onAdd(props.source, addKey, props.ownerPlayerId);
                setAddKey("");
              }}
              disabled={!addKey}
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>
      {props.children ? <div style={{ marginTop: 8 }}>{props.children}</div> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {rows.length === 0 ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>None</div> : null}
        {rows.map((facility) => {
          const definition = facility.definition;
          const orders = orderListWithMaintain(definition?.orders ?? []);
          return (
            <div key={facility.id} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>{definition?.name ?? facility.facilityKey}</div>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                    {definition?.prerequisite ? `Prerequisite: ${definition.prerequisite}` : "No prerequisite"}
                    {definition?.hirelings != null ? ` - Hirelings: ${definition.hirelings}` : ""}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => props.onRemove(facility.id)}>Remove</Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8, marginTop: 8 }}>
                <Select
                  value={facility.order ?? "Maintain"}
                  onChange={(e) => props.onUpdate(facility.id, { order: normalizeOrder(e.target.value) })}
                >
                  {orders.map((order) => (
                    <option key={`${facility.id}:${order}`} value={order}>{order}</option>
                  ))}
                </Select>
                <Input
                  value={facility.notes}
                  onChange={(e) => props.onUpdate(facility.id, { notes: e.target.value })}
                  placeholder="Facility notes"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
