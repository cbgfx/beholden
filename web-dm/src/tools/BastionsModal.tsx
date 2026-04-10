import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { api, jsonInit } from "@/services/api";
import { useWs } from "@/services/ws";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import type { Bastion, BastionCompendiumResponse, BastionFacility, BastionsResponse, CompendiumFacility } from "@/tools/bastions/types";
import { useBastionAutosave } from "@/tools/bastions/useBastionAutosave";
import { chipButtonStyle } from "@/tools/bastions/styles";
import { BastionsSidebar } from "@/tools/bastions/BastionsSidebar";
import { BastionOverviewPanel } from "@/tools/bastions/BastionOverviewPanel";
import { BastionFacilitiesPanel } from "@/tools/bastions/BastionFacilitiesPanel";

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

  const selectedBastion = React.useMemo(
    () => bastions.find((bastion) => bastion.id === selectedBastionId) ?? null,
    [bastions, selectedBastionId],
  );
  const selectedAssignedKey = React.useMemo(
    () => selectedBastion?.assignedPlayerIds.join(",") ?? "",
    [selectedBastion?.assignedPlayerIds],
  );
  const { registerLoadedBastions } = useBastionAutosave({
    campaignId,
    isOpen: props.isOpen,
    selectedBastion,
    setSaving,
    setMessage,
  });

  const facilitiesByKey = React.useMemo(() => {
    const map = new Map<string, CompendiumFacility>();
    for (const facility of compendium?.facilities ?? []) map.set(facility.key, facility);
    return map;
  }, [compendium?.facilities]);

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
      registerLoadedBastions(bastionData.bastions);
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

  useWs((msg) => {
    if (!props.isOpen || !campaignId) return;
    if (msg.type !== "bastions:changed") return;
    const payload = msg.payload;
    const changedCampaignId = payload && typeof payload === "object"
      ? (payload as { campaignId?: unknown }).campaignId
      : undefined;
    if (typeof changedCampaignId !== "string" || changedCampaignId !== campaignId) return;
    void load(selectedBastionId);
  });

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

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Bastions" width={1200} height={760}>
      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "320px 1fr", background: "transparent" }}>
        <BastionsSidebar
          campaignId={campaignId}
          bastions={bastions}
          selectedBastionId={selectedBastionId}
          saving={saving}
          onCreateBastion={() => void createBastion()}
          onSelectBastion={setSelectedBastionId}
        />

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

              <BastionOverviewPanel
                selectedBastion={selectedBastion}
                players={players}
                facilitiesByKey={facilitiesByKey}
                overviewExpanded={overviewExpanded}
                onToggleOverview={() => setOverviewExpanded((prev) => !prev)}
                onToggleAssignedPlayer={toggleAssignedPlayer}
                onUpdateSelectedDraft={updateSelectedDraft}
              />

              <BastionFacilitiesPanel
                selectedBastion={selectedBastion}
                players={players}
                compendiumFacilities={compendium?.facilities ?? []}
                facilitiesByKey={facilitiesByKey}
                facilitiesExpanded={facilitiesExpanded}
                activePlayerFacilityId={activePlayerFacilityId}
                onToggleFacilities={() => setFacilitiesExpanded((prev) => !prev)}
                onSetActivePlayerFacilityId={setActivePlayerFacilityId}
                onAddFacility={addFacility}
                onUpdateFacility={updateFacility}
                onRemoveFacility={removeFacility}
              />

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

