import { useUiMessages } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { useWs } from "@/services/ws";
import { createOperationQueue, getClientId, isOwnEcho } from "@beholden/shared/ui";
import { Panel, SubsectionLabel } from "@beholden/shared/ui";
import type { Bastion, BastionCompendiumResponse, BastionFacility, BastionResponse, CompendiumFacility } from "./BastionViewShared";
import { sortFacilitiesByLevelThenName } from "./BastionViewShared";
import { FALLBACK_SPECIAL_FACILITY_SLOTS, specialFacilitySlotsForLevel } from "@beholden/shared/domain/bastionFacilities";
import { FacilityRows } from "./BastionFacilityRows";
import { BastionHeader } from "./BastionHeader";
import { BastionFacilityDetailPanel } from "./BastionFacilityDetailPanel";
import { BastionOwnerFacilityGroup } from "./BastionOwnerFacilityGroup";
import { useUiTranslation } from "@beholden/shared/i18n";

/** What every bastion operation endpoint responds with. */
type OperationResponse = { ok: boolean; bastion: Bastion; facilityId?: string };

function withFacilityPatch(bastion: Bastion, facilityId: string, patch: Partial<BastionFacility>): Bastion {
  return {
    ...bastion,
    facilities: bastion.facilities.map((facility) => (facility.id === facilityId ? { ...facility, ...patch } : facility)),
  };
}

export function BastionView() {
  const t = useUiTranslation("playerUi");
  const translateMessage = useUiMessages("playerUi");
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

  const compendiumRef = React.useRef<BastionCompendiumResponse | null>(null);

  /**
   * Every edit is one small server operation (add, remove, set an order, set notes) applied to the
   * current bastion, so edits by different people to different facilities never overwrite each
   * other. The queue shows each change at once, sends them in order, and drops one the server refuses.
   */
  const [queue] = React.useState(() => {
    let failed = false;
    return createOperationQueue<Bastion>({
      onChange: setBastion,
      version: (b) => b.updatedAt,
      onBusyChange: (busy) => {
        setSaving(busy);
        if (busy) failed = false;
        else if (!failed) setSaveMessage({ text: translateMessage("Saved."), ok: true });
      },
      onError: (e) => {
        failed = true;
        setSaveMessage({ text: e instanceof Error ? e.message : translateMessage("Failed to save."), ok: false });
      },
    });
  });

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
      // Static rules data: fetched once per session, not on every refresh.
      compendiumRef.current ?? api<BastionCompendiumResponse>("/api/compendium/bastions"),
      api<BastionResponse>(`/api/campaigns/${campaignId}/bastions/${bastionId}`),
    ])
      .then(([compendiumData, bastionData]) => {
        compendiumRef.current = compendiumData;
        setCompendium(compendiumData);
        setCurrentUserPlayerIds(bastionData.currentUserPlayerIds ?? []);
        if (!bastionData.bastion) {
          setError(translateMessage("Bastion not found."));
          queue.receive(null);
          return;
        }
        // Edits still on their way stay applied on top, and a refresh older than what's shown is ignored.
        queue.receive(bastionData.bastion);
      })
      .catch((e) => {
        setError(e?.message ?? translateMessage("Failed to load Bastion."));
      })
      .finally(() => {
        if (!background) setLoading(false);
      });
  }, [campaignId, bastionId, queue, translateMessage]);

  React.useEffect(() => { load(); }, [load]);

  useWs(React.useCallback((msg) => {
    if (msg.type === "ws:reconnected") {
      load({ background: true });
      return;
    }
    const changedCampaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (changedCampaignId !== campaignId) return;

    if (msg.type === "bastions:delta") {
      // Our own operation echoing back. Its response already gave us the saved bastion.
      if (isOwnEcho(msg.payload)) return;

      const payload = (msg.payload as any) as { action?: "upsert" | "delete" | "refresh"; bastionId?: string };
      if (payload.action === "delete" && payload.bastionId === bastionId) {
        queue.receive(null);
        setError(translateMessage("Bastion not found."));
        return;
      }
      if ((payload.action === "upsert" && payload.bastionId === bastionId) || payload.action === "refresh") {
        load({ background: true });
      }
    }
  }, [bastionId, campaignId, load, queue, translateMessage]));

  /** Performs one operation on this bastion and returns the saved bastion. */
  const send = React.useCallback(
    (method: string, path: string, body: Record<string, unknown> = {}) =>
      api<OperationResponse>(
        `/api/campaigns/${campaignId}/bastions/${bastionId}${path}`,
        jsonInit(method, { clientId: getClientId(), ...body }),
      ),
    [campaignId, bastionId],
  );

  function setFacilityOrder(facilityId: string, order: string | null) {
    void queue.run(
      (b) => withFacilityPatch(b, facilityId, { order }),
      async () => (await send("PATCH", `/facilities/${facilityId}`, { order })).bastion,
    );
  }

  /** Resolves to whether it saved, so the notes field can keep the text for another try if not. */
  function commitFacilityNotes(facilityId: string, notes: string) {
    return queue.run(
      (b) => withFacilityPatch(b, facilityId, { notes }),
      async () => (await send("PATCH", `/facilities/${facilityId}`, { notes })).bastion,
    );
  }

  function removePlayerFacility(facilityId: string) {
    void queue.run(
      (b) => ({ ...b, facilities: b.facilities.filter((facility) => facility.id !== facilityId) }),
      async () => (await send("DELETE", `/facilities/${facilityId}`)).bastion,
    );
  }

  async function addPlayerFacility(ownerPlayerId: string) {
    const addKey = addKeyByOwner[ownerPlayerId] ?? "";
    if (!addKey) return;
    let addedId: string | undefined;
    // Not shown ahead of the server: the server assigns the facility's id, and an edit made before
    // then would have nothing to address.
    const added = await queue.run((b) => b, async () => {
      const result = await send("POST", "/facilities", { facilityKey: addKey, source: "player", ownerPlayerId });
      addedId = result.facilityId;
      return result.bastion;
    });
    if (!added) return;
    setAddKeyByOwner((prev) => ({ ...prev, [ownerPlayerId]: "" }));
    if (addedId) setSelectedFacilityId(addedId);
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
  // Slots by level come from the compendium's rules entry.
  const slotProgression = compendium?.specialFacilitySlots ?? FALLBACK_SPECIAL_FACILITY_SLOTS;
  const ownSpecialSlots = editableOwnerIds.reduce((sum, ownerId) => {
    const ownerLevel = bastion?.assignedPlayers?.find((e) => e.id === ownerId)?.level ?? 1;
    return sum + specialFacilitySlotsForLevel(ownerLevel, slotProgression);
  }, 0);

  const availableOptionsByOwner = React.useMemo(() => {
    if (!bastion) return new Map<string, CompendiumFacility[]>();
    const out = new Map<string, CompendiumFacility[]>();
    for (const ownerId of editableOwnerIds) {
      const ownerLevel = bastion.assignedPlayers?.find((p) => p.id === ownerId)?.level ?? 1;
      const ownerSlots = specialFacilitySlotsForLevel(ownerLevel, slotProgression);
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
  }, [bastion, compendium?.facilities, editableOwnerIds, facilitiesByKey, playerFacilities, slotProgression]);

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
        {t("Loading...")}
      </div>
    );
  }

  if (error || !bastion) {
    return (
      <div style={{ height: "100%", background: C.bg, color: C.colorPinkRed, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {error ?? t("Not found.")}
      </div>
    );
  }

  // Each facility counts at its current size, upgrades included.
  const hirelingsTotal = bastion.facilities.reduce((sum, f) => sum + (f.hirelings ?? f.definition?.hirelings ?? facilitiesByKey.get(f.facilityKey)?.hirelings ?? 0), 0);
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
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Player Facilities */}
          <Panel>
            <SubsectionLabel>{t("Your Facilities")}</SubsectionLabel>
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
                    adding={saving}
                    onAddKeyChange={(value) => setAddKeyByOwner((prev) => ({ ...prev, [ownerId]: value }))}
                    onAdd={() => void addPlayerFacility(ownerId)}
                    onChangeOrder={setFacilityOrder}
                    onCommitNotes={commitFacilityNotes}
                    onRemove={removePlayerFacility}
                    facilitiesByKey={facilitiesByKey}
                    spaces={compendium?.spaces ?? []}
                    selectedFacilityId={selectedFacility?.id ?? null}
                    onSelectFacility={(facilityId) => setSelectedFacilityId(facilityId)}
                  />
                ))}
              </div>
              <BastionFacilityDetailPanel
                selectedFacility={selectedFacility}
                facilitiesByKey={facilitiesByKey}
                spaces={compendium?.spaces ?? []}
                assignedPlayers={bastion.assignedPlayers}
              />
            </div>
          </Panel>
          {/* DM Extra Facilities */}
          {dmExtraFacilities.length > 0 && (
            <Panel>
              <SubsectionLabel>{t("DM Extra Facilities")}</SubsectionLabel>
              <FacilityRows
                rows={dmExtraFacilities}
                facilitiesByKey={facilitiesByKey}
                spaces={compendium?.spaces ?? []}
                selectedFacilityId={selectedFacility?.id ?? null}
                onSelectFacility={(facilityId) => setSelectedFacilityId(facilityId)}
              />
            </Panel>
          )}

          {/* Bastion notes are the DM's; players see them but edit notes on their own facilities. */}
          {bastion.notes.trim() ? (
            <Panel>
              <SubsectionLabel>{t("Notes")}</SubsectionLabel>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {bastion.notes}
              </div>
            </Panel>
          ) : null}

        </div>
      </div>
    </div>
  );
}
