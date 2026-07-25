import React from "react";
import { useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { useWs } from "@/services/ws";
import { Panel, SubsectionLabel } from "@beholden/shared/ui";
import type { Bastion, BastionCompendiumResponse, BastionResponse, CompendiumFacility } from "./BastionViewShared";
import {
  inputStyle,
  normalizeOrder,
  sortFacilitiesByLevelThenName,
} from "./BastionViewShared";
import { FacilityRows } from "./BastionFacilityRows";
import { BastionHeader } from "./BastionHeader";
import { BastionFacilityDetailPanel } from "./BastionFacilityDetailPanel";
import { BastionOwnerFacilityGroup } from "./BastionOwnerFacilityGroup";

export function BastionView() {
  const { id: campaignId, bastionId } = useParams<{ id: string; bastionId: string }>();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<{ text: string; ok: boolean } | null>(null);
  const [currentUserPlayerIds, setCurrentUserPlayerIds] = React.useState<string[]>([]);
  const [compendium, setCompendium] = React.useState<BastionCompendiumResponse | null>(null);
  const [bastion, setBastion] = React.useState<Bastion | null>(null);
  const [addKeyByOwner, setAddKeyByOwner] = React.useState<Record<string, string>>({});
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<string | null>(null);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const bastionRef = React.useRef<Bastion | null>(null);
  bastionRef.current = bastion;

  const facilitiesByKey = React.useMemo(() => {
    const map = new Map<string, CompendiumFacility>();
    for (const facility of compendium?.facilities ?? []) map.set(facility.key, facility);
    return map;
  }, [compendium?.facilities]);

  const load = React.useCallback((options?: { background?: boolean }) => {
    const background = options?.background ?? false;
    if (!campaignId || !bastionId) return;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    Promise.all([
      api<BastionCompendiumResponse>("/api/compendium/bastions"),
      api<BastionResponse>(`/api/campaigns/${campaignId}/bastions/${bastionId}`),
    ])
      .then(([compendiumData, bastionData]) => {
        setCompendium(compendiumData);
        setCurrentUserPlayerIds(bastionData.currentUserPlayerIds ?? []);
        if (!bastionData.bastion) {
          setError("Bastion not found.");
          setBastion(null);
          return;
        }
        setBastion(bastionData.bastion);
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to load Bastion.");
      })
      .finally(() => {
        if (!background) setLoading(false);
      });
  }, [campaignId, bastionId]);

  React.useEffect(() => { load(); }, [load]);

  useWs(React.useCallback((msg) => {
    const changedCampaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (changedCampaignId !== campaignId) return;

    if (msg.type === "bastions:delta") {
      const payload = (msg.payload as any) as { action?: "upsert" | "delete" | "refresh"; bastionId?: string };
      if (payload.action === "delete" && payload.bastionId === bastionId) {
        setBastion(null);
        setError("Bastion not found.");
        return;
      }
      if (payload.action === "upsert" && payload.bastionId === bastionId) {
        load({ background: true });
        return;
      }
      if (payload.action === "refresh") {
        load({ background: true });
        return;
      }
    }

  }, [bastionId, campaignId, load]));

  const scheduleAutoSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const b = bastionRef.current;
      if (!campaignId || !b) return;
      setSaving(true);
      try {
        await api(`/api/campaigns/${campaignId}/bastions/${b.id}/player`, jsonInit("PATCH", {
          maintainOrder: b.maintainOrder,
          notes: b.notes,
          facilities: b.facilities.map((facility) => ({
            id: facility.id,
            facilityKey: facility.facilityKey,
            source: facility.source,
            ownerPlayerId: facility.ownerPlayerId,
            order: normalizeOrder(facility.order),
            notes: facility.notes,
          })),
        }));
        setSaveMessage({ text: "Saved.", ok: true });
      } catch (e) {
        setSaveMessage({ text: e instanceof Error ? e.message : "Failed to save.", ok: false });
      } finally {
        setSaving(false);
      }
    }, 1200);
  }, [campaignId]);

  function mutateBastionAndSave(updater: (prev: Bastion) => Bastion) {
    setBastion((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      return next;
    });
    scheduleAutoSave();
  }

  function updateFacility(facilityId: string, patch: Partial<import("./BastionViewShared").BastionFacility>) {
    mutateBastionAndSave((prev) => ({
      ...prev,
      facilities: prev.facilities.map((f) => (f.id === facilityId ? { ...f, ...patch } : f)),
    }));
  }

  function removePlayerFacility(facilityId: string) {
    mutateBastionAndSave((prev) => ({
      ...prev,
      facilities: prev.facilities.filter((f) => !(f.id === facilityId && f.source === "player")),
    }));
  }

  function addPlayerFacility(ownerPlayerId: string) {
    const addKey = addKeyByOwner[ownerPlayerId] ?? "";
    if (!bastion || !addKey) return;
    const definition = facilitiesByKey.get(addKey);
    if (!definition) return;
    mutateBastionAndSave((prev) => ({
      ...prev,
      facilities: [
        ...prev.facilities,
        {
          id: `draft:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          facilityKey: addKey,
          source: "player",
          ownerPlayerId,
          order: null,
          notes: "",
          definition,
        },
      ],
    }));
    setAddKeyByOwner((prev) => ({ ...prev, [ownerPlayerId]: "" }));
  }

  const playerFacilities = React.useMemo(
    () => bastion?.facilities.filter((f) => f.source === "player") ?? [],
    [bastion?.facilities],
  );
  const dmExtraFacilities = React.useMemo(
    () => bastion?.facilities.filter((f) => f.source === "dm_extra") ?? [],
    [bastion?.facilities],
  );
  const ownedUserIds = React.useMemo(
    () =>
      new Set(
        (bastion?.assignedPlayers ?? [])
          .filter((entry) => currentUserPlayerIds.includes(entry.id) && entry.userId)
          .map((entry) => String(entry.userId)),
      ),
    [bastion?.assignedPlayers, currentUserPlayerIds],
  );
  const editableOwnerIds = React.useMemo(
    () => {
      const ids = (bastion?.assignedPlayers ?? [])
        .filter((entry) => currentUserPlayerIds.includes(entry.id) || (entry.userId ? ownedUserIds.has(String(entry.userId)) : false))
        .map((entry) => entry.id);
      return Array.from(new Set(ids.length > 0 ? ids : currentUserPlayerIds));
    },
    [bastion?.assignedPlayers, currentUserPlayerIds, ownedUserIds],
  );
  const editableOwnerIdSet = React.useMemo(() => new Set(editableOwnerIds), [editableOwnerIds]);
  const editablePlayerFacilities = playerFacilities.filter((f) => f.ownerPlayerId && editableOwnerIdSet.has(f.ownerPlayerId));
  const playerSpecialUsed = editablePlayerFacilities.filter((f) => {
    const def = f.definition ?? facilitiesByKey.get(f.facilityKey);
    return def?.type === "special";
  }).length;
  const ownSpecialSlots = editableOwnerIds.reduce((sum, ownerId) => {
    const ownerLevel = bastion?.assignedPlayers?.find((e) => e.id === ownerId)?.level ?? 1;
    if (ownerLevel >= 17) return sum + 6;
    if (ownerLevel >= 13) return sum + 5;
    if (ownerLevel >= 9) return sum + 4;
    if (ownerLevel >= 5) return sum + 2;
    return sum;
  }, 0);

  const availableOptionsByOwner = React.useMemo(() => {
    if (!bastion) return new Map<string, CompendiumFacility[]>();
    const out = new Map<string, CompendiumFacility[]>();
    for (const ownerId of editableOwnerIds) {
      const ownerLevel = bastion.assignedPlayers?.find((p) => p.id === ownerId)?.level ?? 1;
      const ownerSlots = ownerLevel >= 17 ? 6 : ownerLevel >= 13 ? 5 : ownerLevel >= 9 ? 4 : ownerLevel >= 5 ? 2 : 0;
      const ownerCounts = new Map<string, number>();
      for (const facility of playerFacilities) {
        if (facility.ownerPlayerId !== ownerId) continue;
        ownerCounts.set(facility.facilityKey, (ownerCounts.get(facility.facilityKey) ?? 0) + 1);
      }
      const ownerUsed = playerFacilities.filter((f) => {
        if (f.ownerPlayerId !== ownerId) return false;
        const def = f.definition ?? facilitiesByKey.get(f.facilityKey);
        return def?.type === "special";
      }).length;
      out.set(ownerId, sortFacilitiesByLevelThenName((compendium?.facilities ?? []).filter((f) => {
        if (f.minimumLevel > ownerLevel) return false;
        if (!f.allowMultiple && (ownerCounts.get(f.key) ?? 0) > 0) return false;
        if (f.type === "special" && ownerUsed >= ownerSlots) return false;
        return true;
      })));
    }
    return out;
  }, [bastion, compendium?.facilities, editableOwnerIds, facilitiesByKey, playerFacilities]);

  const selectableFacilities = React.useMemo(
    () => [...editablePlayerFacilities, ...dmExtraFacilities],
    [dmExtraFacilities, editablePlayerFacilities],
  );
  const selectedFacility = React.useMemo(
    () => selectableFacilities.find((facility) => facility.id === selectedFacilityId) ?? selectableFacilities[0] ?? null,
    [selectableFacilities, selectedFacilityId],
  );

  React.useEffect(() => {
    if (!selectedFacility) {
      if (selectedFacilityId !== null) setSelectedFacilityId(null);
      return;
    }
    if (selectedFacilityId !== selectedFacility.id) {
      setSelectedFacilityId(selectedFacility.id);
    }
  }, [selectedFacility, selectedFacilityId]);

  if (loading) {
    return (
      <div style={{ height: "100%", background: C.bg, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading...
      </div>
    );
  }

  if (error || !bastion) {
    return (
      <div style={{ height: "100%", background: C.bg, color: C.colorPinkRed, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {error ?? "Not found."}
      </div>
    );
  }

  const hirelingsTotal = bastion.facilities.reduce((sum, f) => sum + (f.definition?.hirelings ?? facilitiesByKey.get(f.facilityKey)?.hirelings ?? 0), 0);
  const defendersTotal = Math.max(0, (bastion.defendersArmed ?? 0) + (bastion.defendersUnarmed ?? 0));
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 48px" }}>
        <BastionHeader
          bastion={bastion}
          campaignId={campaignId}
          playerSpecialUsed={playerSpecialUsed}
          ownSpecialSlots={ownSpecialSlots}
          hirelingsTotal={hirelingsTotal}
          defendersTotal={defendersTotal}
          saving={saving}
          saveMessage={saveMessage}
          onToggleMaintain={() => mutateBastionAndSave((b) => {
            const nextMaintain = !b.maintainOrder;
            return {
              ...b,
              maintainOrder: nextMaintain,
              facilities: nextMaintain
                ? b.facilities.map((facility) => (
                  facility.source === "player" && facility.ownerPlayerId && editableOwnerIdSet.has(facility.ownerPlayerId)
                    ? { ...facility, order: "Maintain" }
                    : facility
                ))
                : b.facilities,
            };
          })}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Player Facilities */}
          <Panel>
            <SubsectionLabel>Your Facilities</SubsectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
                gap: 14,
                alignItems: "start",
              }}
            >
              <div>
                {editableOwnerIds.map((ownerId) => (
                  <BastionOwnerFacilityGroup
                    key={`owner:${ownerId}`}
                    ownerId={ownerId}
                    owner={bastion.assignedPlayers?.find((e) => e.id === ownerId)}
                    rows={playerFacilities.filter((f) => f.ownerPlayerId === ownerId)}
                    ownerOptions={availableOptionsByOwner.get(ownerId) ?? []}
                    addKey={addKeyByOwner[ownerId] ?? ""}
                    onAddKeyChange={(value) => setAddKeyByOwner((prev) => ({ ...prev, [ownerId]: value }))}
                    onAdd={() => addPlayerFacility(ownerId)}
                    onUpdate={updateFacility}
                    onRemove={removePlayerFacility}
                    facilitiesByKey={facilitiesByKey}
                    selectedFacilityId={selectedFacility?.id ?? null}
                    onSelectFacility={(facilityId) => setSelectedFacilityId(facilityId)}
                  />
                ))}
              </div>
              <BastionFacilityDetailPanel
                selectedFacility={selectedFacility}
                facilitiesByKey={facilitiesByKey}
                assignedPlayers={bastion.assignedPlayers}
              />
            </div>
          </Panel>
          {/* DM Extra Facilities */}
          {dmExtraFacilities.length > 0 && (
            <Panel>
              <SubsectionLabel>DM Extra Facilities</SubsectionLabel>
              <FacilityRows
                rows={dmExtraFacilities}
                facilitiesByKey={facilitiesByKey}
                selectedFacilityId={selectedFacility?.id ?? null}
                onSelectFacility={(facilityId) => setSelectedFacilityId(facilityId)}
              />
            </Panel>
          )}

          {/* Notes */}
          <Panel>
            <SubsectionLabel>Notes</SubsectionLabel>
            <textarea
              value={bastion.notes}
              onChange={(e) => mutateBastionAndSave((b) => ({ ...b, notes: e.target.value }))}
              placeholder="Bastion notes..."
              style={{
                ...inputStyle,
                minHeight: 90,
                resize: "vertical",
              }}
            />
          </Panel>

        </div>
      </div>
    </div>
  );
}
