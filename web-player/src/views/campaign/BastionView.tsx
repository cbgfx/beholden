import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { useWs } from "@/services/ws";
import { IconBastions } from "@beholden/shared/icons";
import { HeaderActionLink, Panel, SectionTitle, SubsectionLabel } from "@beholden/shared/ui";
import { Select } from "@/ui/Select";

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
  defendersArmed: number;
  defendersUnarmed: number;
  assignedPlayerIds: string[];
  assignedPlayers?: Array<{ id: string; userId: string | null; level: number; characterId: string | null; characterName: string }>;
  notes: string;
  maintainOrder: boolean;
  facilities: BastionFacility[];
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
  hirelingsTotal?: number;
};

type BastionResponse = {
  ok: boolean;
  role: "dm" | "player";
  currentUserPlayerIds: string[];
  bastion: Bastion;
};

type BastionCompendiumResponse = {
  ok: boolean;
  facilities: CompendiumFacility[];
};

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

// ---------------------------------------------------------------------------
// Toggle pill style (Active / Maintain)
// ---------------------------------------------------------------------------
function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? `${C.colorGold}99` : C.panelBorder}`,
    background: active ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.04)",
    color: active ? C.colorGold : C.muted,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    transition: "all 120ms ease",
  };
}

function ghostButtonStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 11px",
    borderRadius: 8,
    border: `1px solid rgba(251,191,36,0.35)`,
    background: "rgba(251,191,36,0.10)",
    color: C.colorGold,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 700,
  };
}

function accentButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 14px",
    borderRadius: 8,
    border: "none",
    background: enabled ? C.colorGold : "rgba(255,255,255,0.08)",
    color: enabled ? C.textDark : C.muted,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    transition: "background 120ms ease",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: `1px solid ${C.panelBorder}`,
  background: "rgba(0,0,0,0.30)",
  color: C.text,
  fontSize: "var(--fs-small)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

// ---------------------------------------------------------------------------

export function BastionView() {
  const { id: campaignId, bastionId } = useParams<{ id: string; bastionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<{ text: string; ok: boolean } | null>(null);
  const [currentUserPlayerIds, setCurrentUserPlayerIds] = React.useState<string[]>([]);
  const [compendium, setCompendium] = React.useState<BastionCompendiumResponse | null>(null);
  const [bastion, setBastion] = React.useState<Bastion | null>(null);
  const [addKeyByOwner, setAddKeyByOwner] = React.useState<Record<string, string>>({});
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<string | null>(null);

  // Debounced auto-save ref
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

  // Auto-save with debounce
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

  function updateFacility(facilityId: string, patch: Partial<BastionFacility>) {
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

  const playerFacilities = bastion?.facilities.filter((f) => f.source === "player") ?? [];
  const dmExtraFacilities = bastion?.facilities.filter((f) => f.source === "dm_extra") ?? [];
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
    const counts = new Map<string, number>();
    for (const f of bastion.facilities) counts.set(f.facilityKey, (counts.get(f.facilityKey) ?? 0) + 1);
    for (const ownerId of editableOwnerIds) {
      const ownerLevel = bastion.assignedPlayers?.find((p) => p.id === ownerId)?.level ?? 1;
      const ownerSlots = ownerLevel >= 17 ? 6 : ownerLevel >= 13 ? 5 : ownerLevel >= 9 ? 4 : ownerLevel >= 5 ? 2 : 0;
      const ownerUsed = playerFacilities.filter((f) => {
        if (f.ownerPlayerId !== ownerId) return false;
        const def = f.definition ?? facilitiesByKey.get(f.facilityKey);
        return def?.type === "special";
      }).length;
      out.set(ownerId, (compendium?.facilities ?? []).filter((f) => {
        if (f.minimumLevel > ownerLevel) return false;
        if (!f.allowMultiple && (counts.get(f.key) ?? 0) > 0) return false;
        if (f.type === "special" && ownerUsed >= ownerSlots) return false;
        return true;
      }));
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
        <HeaderActionLink to={campaignId ? `/campaigns/${campaignId}` : "/"} color={C.muted} padding="0 0 20px" borderRadius={0} fontSize="var(--fs-small)">
          {"<- Back to Campaign"}
        </HeaderActionLink>

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 20,
            padding: "14px 16px 18px",
            borderRadius: 14,
            border: "1px solid rgba(251,191,36,0.20)",
            background:
              "radial-gradient(130% 160% at 0% 0%, rgba(251,191,36,0.16) 0%, rgba(56,182,255,0.08) 45%, rgba(255,255,255,0.02) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid rgba(251,191,36,0.52)`,
                  background: "linear-gradient(180deg, rgba(251,191,36,0.26), rgba(251,191,36,0.10))",
                  color: C.colorGold,
                  flexShrink: 0,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.28), 0 10px 24px rgba(251,191,36,0.18)",
                }}
              >
                <IconBastions size={22} />
              </span>
              <SectionTitle
                color={C.text}
                style={{
                  textTransform: "none",
                  letterSpacing: -0.2,
                  fontSize: "clamp(2.15rem, 2.5vw, 2.65rem)",
                  fontWeight: 900,
                  marginBottom: 0,
                  lineHeight: 1.05,
                  textShadow: "0 2px 16px rgba(56,182,255,0.15)",
                }}
              >
                {bastion.name}
              </SectionTitle>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Level {bastion.level}</span>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>|</span>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Slots {playerSpecialUsed}/{ownSpecialSlots}</span>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>|</span>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Hirelings {hirelingsTotal}</span>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>|</span>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                Defenders {defendersTotal} ({bastion.defendersArmed ?? 0} armed / {bastion.defendersUnarmed ?? 0} unarmed)
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {saving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, opacity: 0.6 }}>Saving...</span>}
            {!saving && saveMessage && (
              <span style={{ fontSize: "var(--fs-tiny)", color: saveMessage.ok ? C.muted : C.colorPinkRed }}>
                {saveMessage.text}
              </span>
            )}
            <button
              type="button"
              onClick={() => mutateBastionAndSave((b) => {
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
              style={pillStyle(bastion.maintainOrder)}
            >
              Maintain
            </button>
          </div>
        </div>

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
                {editableOwnerIds.map((ownerId) => {
                  const owner = bastion.assignedPlayers?.find((e) => e.id === ownerId);
                  const rows = playerFacilities.filter((f) => f.ownerPlayerId === ownerId);
                  const ownerOptions = availableOptionsByOwner.get(ownerId) ?? [];
                  return (
                    <div key={`owner:${ownerId}`} style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted }}>
                        {owner?.characterName || "Assigned Character"}
                        <span style={{ fontWeight: 400, marginLeft: 6 }}>Lv {owner?.level ?? 1}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <Select
                          value={addKeyByOwner[ownerId] ?? ""}
                          onChange={(e) => setAddKeyByOwner((prev) => ({ ...prev, [ownerId]: e.target.value }))}
                          style={{ flex: 1 }}
                        >
                          <option value="">Add facility...</option>
                          {ownerOptions.map((f) => (
                            <option key={`${ownerId}:${f.key}`} value={f.key}>
                              {f.name} ({f.type}, lvl {f.minimumLevel})
                            </option>
                          ))}
                        </Select>
                        <button
                          onClick={() => addPlayerFacility(ownerId)}
                          disabled={!(addKeyByOwner[ownerId] ?? "")}
                          style={accentButtonStyle(Boolean(addKeyByOwner[ownerId] ?? ""))}
                        >
                          Add
                        </button>
                      </div>
                      <FacilityRows
                        rows={rows}
                        onUpdate={updateFacility}
                        onRemove={removePlayerFacility}
                        facilitiesByKey={facilitiesByKey}
                        selectedFacilityId={selectedFacility?.id ?? null}
                        onSelectFacility={(facilityId) => setSelectedFacilityId(facilityId)}
                      />
                    </div>
                  );
                })}
              </div>
              <Panel style={{ padding: "10px 12px", minHeight: 220 }}>
                <SubsectionLabel>Facility Details</SubsectionLabel>
                {selectedFacility ? (
                  (() => {
                    const definition = selectedFacility.definition ?? facilitiesByKey.get(selectedFacility.facilityKey) ?? null;
                    const owner = selectedFacility.ownerPlayerId
                      ? bastion.assignedPlayers?.find((entry) => entry.id === selectedFacility.ownerPlayerId)
                      : null;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text }}>
                          {definition?.name ?? selectedFacility.facilityKey}
                        </div>
                        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                          {definition ? `${definition.type === "special" ? "Special" : "Basic"} facility` : "Facility"}
                          {definition ? ` - Min level ${definition.minimumLevel}` : ""}
                        </div>
                        {owner ? (
                          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                            Owner: {owner.characterName} (Lv {owner.level})
                          </div>
                        ) : null}
                        {definition?.prerequisite ? (
                          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                            Prerequisite: {definition.prerequisite}
                          </div>
                        ) : null}
                        {definition?.hirelings != null ? (
                          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                            Hirelings: {definition.hirelings}
                          </div>
                        ) : null}
                        {definition?.orders?.length ? (
                          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                            Orders: {orderListWithMaintain(definition.orders).join(", ")}
                          </div>
                        ) : null}
                        <div
                          style={{
                            marginTop: 4,
                            border: `1px solid ${C.panelBorder}`,
                            borderRadius: 8,
                            padding: "10px 12px",
                            background: "rgba(255,255,255,0.02)",
                            fontSize: "var(--fs-small)",
                            color: C.muted,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {definition?.description?.trim() || "No compendium description available for this facility."}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted, opacity: 0.75 }}>
                    Select a facility on the left to view its description and details.
                  </div>
                )}
              </Panel>
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

// ---------------------------------------------------------------------------
// FacilityRows
// ---------------------------------------------------------------------------

function FacilityRows(props: {
  rows: BastionFacility[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  onUpdate?: (facilityId: string, patch: Partial<BastionFacility>) => void;
  onRemove?: (facilityId: string) => void;
  selectedFacilityId?: string | null;
  onSelectFacility?: (facilityId: string) => void;
}) {
  if (props.rows.length === 0) {
    return <div style={{ fontSize: "var(--fs-small)", color: C.muted, opacity: 0.5 }}>None</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {props.rows.map((facility) => {
        const definition = facility.definition ?? props.facilitiesByKey.get(facility.facilityKey) ?? null;
        const orders = orderListWithMaintain(definition?.orders ?? []);
        const selected = props.selectedFacilityId === facility.id;
        return (
          <div
            key={facility.id}
            style={{
              border: `1px solid ${selected ? `${C.accentHl}66` : C.panelBorder}`,
              borderRadius: 10,
              padding: "10px 12px",
              background: selected ? "rgba(56,182,255,0.08)" : "rgba(255,255,255,0.02)",
              cursor: props.onSelectFacility ? "pointer" : "default",
            }}
            onClick={() => props.onSelectFacility?.(facility.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--fs-small)", color: C.text }}>
                  {definition?.name ?? facility.facilityKey}
                </div>
                <div style={{ marginTop: 2, fontSize: "var(--fs-tiny)", color: C.muted }}>
                  {definition?.prerequisite ? `Prerequisite: ${definition.prerequisite}` : "No prerequisite"}
                  {definition?.hirelings != null ? ` - Hirelings: ${definition.hirelings}` : ""}
                </div>
              </div>
              {props.onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRemove?.(facility.id);
                  }}
                  style={ghostButtonStyle()}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: orders.length > 0 ? "180px 1fr" : "1fr", gap: 8 }}>
              {orders.length > 0 && (
                <Select
                  value={facility.order ?? "Maintain"}
                  onChange={(e) => props.onUpdate?.(facility.id, { order: normalizeOrder(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!props.onUpdate}
                >
                  {orders.map((order) => (
                    <option key={`${facility.id}:${order}`} value={order}>{order}</option>
                  ))}
                </Select>
              )}
              <input
                value={facility.notes}
                onChange={(e) => props.onUpdate?.(facility.id, { notes: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={inputStyle}
                placeholder="Facility notes..."
                disabled={!props.onUpdate}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
