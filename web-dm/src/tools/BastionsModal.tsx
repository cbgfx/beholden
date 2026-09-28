import { useUiMessages, useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { api, jsonInit } from "@/services/api";
import { useWs } from "@/services/ws";
import { createOperationQueue, getClientId, isOwnEcho } from "@beholden/shared/ui";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import type { Bastion, BastionCompendiumResponse, BastionFacility, BastionResponse, BastionsResponse, CompendiumFacility } from "@/tools/bastions/types";
import { chipButtonStyle } from "@/tools/bastions/styles";
import { BastionsSidebar } from "@/tools/bastions/BastionsSidebar";
import { BastionOverviewPanel } from "@/tools/bastions/BastionOverviewPanel";
import { BastionFacilitiesPanel } from "@/tools/bastions/BastionFacilitiesPanel";
import { CommittedInput } from "@/tools/bastions/CommittedFields";
import { FALLBACK_SPECIAL_FACILITY_SLOTS } from "@beholden/shared/domain/bastionFacilities";

/** What every bastion operation endpoint responds with. */
type OperationResponse = { ok: boolean; bastion: Bastion; facilityId?: string };
type BastionQueue = ReturnType<typeof createOperationQueue<Bastion>>;
/** Bastion-wide fields the DM edits through `PATCH /bastions/:id`. */
type BastionFields = Partial<Pick<Bastion, "name" | "active" | "walled" | "defendersArmed" | "defendersUnarmed" | "notes">>;

function withFacilityPatch(bastion: Bastion, facilityId: string, patch: Partial<BastionFacility>): Bastion {
  return {
    ...bastion,
    facilities: bastion.facilities.map((facility) => (facility.id === facilityId ? { ...facility, ...patch } : facility)),
  };
}

export function BastionsModal(props: { isOpen: boolean; onClose: () => void }) {
  const translateMessage = useUiMessages("dmUi");
  const translateUi = useUiTranslation("dmUi");
  const { state } = useStore();
  const campaignId = state.selectedCampaignId;
  const players = state.players;

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");

  const [compendium, setCompendium] = React.useState<BastionCompendiumResponse | null>(null);
  const [bastions, setBastions] = React.useState<Bastion[]>([]);
  const [selectedBastionId, setSelectedBastionId] = React.useState<string | null>(null);
  /** The player whose facilities the Facilities panel shows, or null for Granted facilities. */
  const [activeOwnerPlayerId, setActiveOwnerPlayerId] = React.useState<string | null>(null);
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

  const compendiumRef = React.useRef<BastionCompendiumResponse | null>(null);
  const scopeRef = React.useRef(campaignId);
  const readSequence = React.useRef(0);
  const translateMessageRef = React.useRef(translateMessage);
  translateMessageRef.current = translateMessage;

  /**
   * One operation queue per bastion. Every edit is a small server operation applied to the current
   * row, so the DM and players editing different things never overwrite each other. A queue shows
   * each change at once, sends them in order, and drops one the server refuses.
   */
  const queuesRef = React.useRef(new Map<string, BastionQueue>());
  const busyBastionIdsRef = React.useRef(new Set<string>());
  const queueFor = React.useCallback((bastionId: string): BastionQueue => {
    const existing = queuesRef.current.get(bastionId);
    if (existing) return existing;
    const queue = createOperationQueue<Bastion>({
      version: (bastion) => bastion.updatedAt,
      onChange: (row) => setBastions((prev) => (
        row ? prev.map((bastion) => (bastion.id === bastionId ? row : bastion)) : prev.filter((bastion) => bastion.id !== bastionId)
      )),
      onBusyChange: (busy) => {
        if (busy) {
          busyBastionIdsRef.current.add(bastionId);
          setMessage("");
        } else {
          busyBastionIdsRef.current.delete(bastionId);
        }
        setSaving(busyBastionIdsRef.current.size > 0);
      },
      onError: (error) => setMessage(error instanceof Error ? error.message : translateMessageRef.current("Failed to save Bastion.")),
    });
    queuesRef.current.set(bastionId, queue);
    return queue;
  }, []);

  React.useEffect(() => {
    scopeRef.current = campaignId;
    readSequence.current++;
    // Queues belong to the campaign being viewed; start fresh for another one.
    queuesRef.current = new Map();
    busyBastionIdsRef.current = new Set();
    setSaving(false);
    setBastions([]);
    setSelectedBastionId(null);
  }, [campaignId]);

  const facilitiesByKey = React.useMemo(() => {
    const map = new Map<string, CompendiumFacility>();
    for (const facility of compendium?.facilities ?? []) map.set(facility.key, facility);
    return map;
  }, [compendium?.facilities]);

  const load = React.useCallback(async (preferredBastionId?: string | null, options?: { background?: boolean }) => {
    if (!props.isOpen || !campaignId) return;
    const sequence = ++readSequence.current;
    // A background refresh leaves the editor mounted. `loading` blanks the whole panel, which
    // throws away focus, cursor position and any open picker -- acceptable on first open, not for
    // a refresh that arrives while someone is typing.
    const background = options?.background ?? false;
    if (!background) {
      setLoading(true);
      setMessage("");
    }
    try {
      // Facility definitions are static rules data -- fetch them once per session rather than on
      // every refresh.
      const [compendiumData, bastionData] = await Promise.all([
        compendiumRef.current ?? api<BastionCompendiumResponse>("/api/compendium/bastions"),
        api<BastionsResponse>(`/api/campaigns/${campaignId}/bastions`),
      ]);
      if (scopeRef.current !== campaignId || sequence !== readSequence.current) return;
      compendiumRef.current = compendiumData;
      setCompendium(compendiumData);
      // Each queue keeps edits still on their way applied on top of what was just read.
      const rows = bastionData.bastions.map((row) => {
        const queue = queueFor(row.id);
        queue.receive(row);
        return queue.current() ?? row;
      });
      setBastions(rows);
      setSelectedBastionId((prev) => {
        if (preferredBastionId && rows.some((bastion) => bastion.id === preferredBastionId)) return preferredBastionId;
        if (prev && rows.some((bastion) => bastion.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (error) {
      if (scopeRef.current === campaignId && sequence === readSequence.current) setMessage(error instanceof Error ? error.message : translateMessage("Failed to load Bastions."));
    } finally {
      if (!background && scopeRef.current === campaignId && sequence === readSequence.current) setLoading(false);
    }
  }, [props.isOpen, campaignId, queueFor, translateMessage]);

  /** Re-reads just one bastion after someone else changed it, instead of the whole list. */
  const refreshBastion = React.useCallback(async (bastionId: string) => {
    if (!campaignId) return;
    try {
      const data = await api<BastionResponse>(`/api/campaigns/${campaignId}/bastions/${bastionId}`);
      if (scopeRef.current !== campaignId) return;
      // Someone else may have just created it.
      setBastions((prev) => (prev.some((bastion) => bastion.id === bastionId) ? prev : [data.bastion, ...prev]));
      queueFor(bastionId).receive(data.bastion);
    } catch {
      // It can no longer be read (deleted meanwhile); a full refresh settles the list.
      if (scopeRef.current === campaignId) void load(undefined, { background: true });
    }
  }, [campaignId, load, queueFor]);

  React.useEffect(() => {
    if (!props.isOpen) return;
    void load();
  }, [props.isOpen, load]);

  useWs((msg) => {
    if (!props.isOpen || !campaignId) return;
    const payload = msg.payload;
    const changedCampaignId = payload && typeof payload === "object"
      ? (payload as { campaignId?: unknown }).campaignId
      : undefined;
    if (typeof changedCampaignId !== "string" || changedCampaignId !== campaignId) return;

    if (msg.type === "bastions:delta") {
      // Our own operation echoing back; its response already gave us the saved bastion.
      if (isOwnEcho(payload)) return;

      const delta = payload && typeof payload === "object"
        ? (payload as { action?: "upsert" | "delete" | "refresh"; bastionId?: string })
        : {};

      if (delta.action === "delete" && delta.bastionId) {
        queuesRef.current.delete(delta.bastionId);
        setBastions((prev) => prev.filter((entry) => entry.id !== delta.bastionId));
        setSelectedBastionId((prev) => (prev === delta.bastionId ? null : prev));
        return;
      }
      if (delta.action === "upsert" && delta.bastionId) {
        void refreshBastion(delta.bastionId);
        return;
      }
      void load(selectedBastionId, { background: true });
    }
  });

  React.useEffect(() => {
    if (!selectedBastion) {
      setActiveOwnerPlayerId(null);
      return;
    }
    setActiveOwnerPlayerId((prev) => (prev && selectedBastion.assignedPlayerIds.includes(prev) ? prev : null));
  }, [selectedBastion, selectedAssignedKey]);

  /** Performs one operation on a bastion and returns the saved bastion. */
  const send = React.useCallback(
    (bastionId: string, method: string, path: string, body: Record<string, unknown> = {}) =>
      api<OperationResponse>(
        `/api/campaigns/${campaignId}/bastions/${bastionId}${path}`,
        jsonInit(method, { clientId: getClientId(), ...body }),
      ),
    [campaignId],
  );

  /** Shows `apply` on the bastion at once and performs the matching operation on the server. */
  function runOperation(bastionId: string, apply: (bastion: Bastion) => Bastion, method: string, path: string, body?: Record<string, unknown>) {
    return queueFor(bastionId).run(apply, async () => (await send(bastionId, method, path, body)).bastion);
  }

  function setFields(bastionId: string, fields: BastionFields) {
    return runOperation(bastionId, (bastion) => ({ ...bastion, ...fields }), "PATCH", "", fields);
  }

  function toggleMaintain(bastion: Bastion) {
    const enabled = !bastion.maintainOrder;
    // Turning it on makes Maintain the order for every player facility, as the server does.
    void runOperation(bastion.id, (row) => ({
      ...row,
      maintainOrder: enabled,
      facilities: enabled
        ? row.facilities.map((facility) => (facility.source === "player" ? { ...facility, order: "Maintain" } : facility))
        : row.facilities,
    }), "PUT", "/maintain", { enabled });
  }

  function toggleAssignedPlayer(bastion: Bastion, playerId: string) {
    if (bastion.assignedPlayerIds.includes(playerId)) {
      // As on the server, the player's facilities stay on the bastion as Granted.
      void runOperation(bastion.id, (row) => ({
        ...row,
        assignedPlayerIds: row.assignedPlayerIds.filter((id) => id !== playerId),
        facilities: row.facilities.map((facility) => (
          facility.source === "player" && facility.ownerPlayerId === playerId
            ? { ...facility, source: "dm_extra" as const, ownerPlayerId: null }
            : facility
        )),
      }), "DELETE", `/players/${playerId}`);
      return;
    }
    void runOperation(bastion.id, (row) => ({ ...row, assignedPlayerIds: [...row.assignedPlayerIds, playerId] }), "PUT", `/players/${playerId}`);
  }

  function addFacility(bastionId: string, source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) {
    // Not shown ahead of the server: the server assigns the facility's id, and an edit made before
    // then would have nothing to address.
    return runOperation(bastionId, (bastion) => bastion, "POST", "/facilities", {
      facilityKey,
      source,
      ...(ownerPlayerId ? { ownerPlayerId } : {}),
    });
  }

  async function createBastion() {
    if (!campaignId) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await api<{ ok: boolean; id: string; bastion: Bastion }>(`/api/campaigns/${campaignId}/bastions`, jsonInit("POST", {
        clientId: getClientId(),
        name: "New Bastion",
        active: false,
        assignedPlayerIds: [],
        facilities: [],
      }));
      // The campaign may have been switched while the request was out.
      if (scopeRef.current !== campaignId) return;
      queueFor(result.id).receive(result.bastion);
      // Newest first, matching the list endpoint's order.
      setBastions((prev) => [result.bastion, ...prev.filter((entry) => entry.id !== result.id)]);
      setSelectedBastionId(result.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translateMessage("Failed to grant Bastion."));
    } finally {
      setSaving(busyBastionIdsRef.current.size > 0);
    }
  }

  async function deleteSelectedBastion() {
    if (!campaignId || !selectedBastion) return;
    if (!window.confirm(`Delete ${selectedBastion.name}?`)) return;
    const bastionId = selectedBastion.id;
    setSaving(true);
    setMessage("");
    try {
      await api(`/api/campaigns/${campaignId}/bastions/${bastionId}`, { method: "DELETE" });
      queuesRef.current.delete(bastionId);
      setBastions((prev) => prev.filter((entry) => entry.id !== bastionId));
      setSelectedBastionId((prev) => (prev === bastionId ? null : prev));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translateMessage("Failed to delete Bastion."));
    } finally {
      setSaving(busyBastionIdsRef.current.size > 0);
    }
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={translateUi("Bastions")} width={1200} height={760}>
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
          {loading ? <div style={{ color: theme.colors.muted }}>{translateUi("Loading...")}</div> : null}
          {!loading && selectedBastion ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                <CommittedInput
                  key={`${selectedBastion.id}:name`}
                  value={selectedBastion.name}
                  // A bastion needs a name; a blank one stays in the field instead of saving.
                  onCommit={(name) => (name.trim() ? setFields(selectedBastion.id, { name: name.trim() }) : false)}
                />
                <button
                  type="button"
                  style={chipButtonStyle(selectedBastion.active)}
                  onClick={() => void setFields(selectedBastion.id, { active: !selectedBastion.active })}
                >
                  {translateUi("Active")}
                </button>
                <button
                  type="button"
                  style={chipButtonStyle(selectedBastion.maintainOrder)}
                  onClick={() => toggleMaintain(selectedBastion)}
                >
                  {translateUi("Maintain")}
                </button>
              </div>

              <BastionOverviewPanel
                selectedBastion={selectedBastion}
                players={players}
                facilitiesByKey={facilitiesByKey}
                overviewExpanded={overviewExpanded}
                onToggleOverview={() => setOverviewExpanded((prev) => !prev)}
                onToggleAssignedPlayer={(playerId) => toggleAssignedPlayer(selectedBastion, playerId)}
                onToggleWalled={() => void setFields(selectedBastion.id, { walled: !selectedBastion.walled })}
                onCommitDefenders={(field, count) => setFields(
                  selectedBastion.id,
                  field === "defendersArmed" ? { defendersArmed: count } : { defendersUnarmed: count },
                )}
                onCommitNotes={(notes) => setFields(selectedBastion.id, { notes })}
              />

              <BastionFacilitiesPanel
                selectedBastion={selectedBastion}
                players={players}
                compendiumFacilities={compendium?.facilities ?? []}
                facilitiesByKey={facilitiesByKey}
                facilitiesExpanded={facilitiesExpanded}
                activeOwnerPlayerId={activeOwnerPlayerId}
                busy={saving}
                spaces={compendium?.spaces ?? []}
                specialFacilitySlots={compendium?.specialFacilitySlots ?? FALLBACK_SPECIAL_FACILITY_SLOTS}
                onToggleFacilities={() => setFacilitiesExpanded((prev) => !prev)}
                onSetActiveOwnerPlayerId={setActiveOwnerPlayerId}
                onAddFacility={(source, facilityKey, ownerPlayerId) => addFacility(selectedBastion.id, source, facilityKey, ownerPlayerId)}
                onChangeOrder={(facilityId, order) => void runOperation(
                  selectedBastion.id,
                  (bastion) => withFacilityPatch(bastion, facilityId, { order }),
                  "PATCH",
                  `/facilities/${facilityId}`,
                  { order },
                )}
                onCommitNotes={(facilityId, notes) => runOperation(
                  selectedBastion.id,
                  (bastion) => withFacilityPatch(bastion, facilityId, { notes }),
                  "PATCH",
                  `/facilities/${facilityId}`,
                  { notes },
                )}
                onRemoveFacility={(facilityId) => void runOperation(
                  selectedBastion.id,
                  (bastion) => ({ ...bastion, facilities: bastion.facilities.filter((facility) => facility.id !== facilityId) }),
                  "DELETE",
                  `/facilities/${facilityId}`,
                )}
                onSetSize={(facilityId, size) => void runOperation(
                  selectedBastion.id,
                  (bastion) => withFacilityPatch(bastion, facilityId, { size }),
                  "PUT",
                  `/facilities/${facilityId}/size`,
                  { size },
                )}
              />

              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Button variant="ghost" onClick={() => void deleteSelectedBastion()} disabled={saving}>{translateUi("Delete Bastion")}</Button>
                <div />
              </div>
            </div>
          ) : null}

          {!loading && !selectedBastion && campaignId ? (
            <div style={{ color: theme.colors.muted }}>{translateUi("Grant a Bastion to begin.")}</div>
          ) : null}

          {message ? (
            <div role="alert" style={{ marginTop: 10, color: message.toLowerCase().includes("fail") || message.toLowerCase().includes("invalid") ? theme.colors.red : theme.colors.muted }}>
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
