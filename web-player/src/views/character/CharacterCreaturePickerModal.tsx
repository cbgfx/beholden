import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { C, withAlpha } from "@/lib/theme";
import { MonsterStatblock } from "@/views/CompendiumView/panels/MonsterStatblock";
import type { CharacterCreature } from "@/views/character/CharacterSheetTypes";
import { addBtnStyle, cancelBtnStyle, inventoryPickerColumnStyle, inventoryPickerListStyle } from "@/views/character/CharacterViewParts";
import { inputStyle } from "@/views/character/CharacterInventoryPanelHelpers";
import { ItemListRow } from "@beholden/shared/ui";

type CompendiumMonsterRow = {
  id: string;
  name: string;
  cr?: string | number | null;
  type?: string | null;
  environment?: string | null;
  size?: string | null;
};

function uid(prefix = "creature"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseLeadingNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const match = value.match(/-?\d+/);
    if (match) return Number(match[0]);
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return parseLeadingNumber(candidate.value ?? candidate.average ?? candidate.ac ?? candidate.hp);
  }
  return null;
}

export function CharacterCreaturePickerModal(props: {
  isOpen: boolean;
  accentColor: string;
  onClose: () => void;
  onAdd: (creature: CharacterCreature) => void;
}) {
  const [rows, setRows] = useState<CompendiumMonsterRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, any>>({});
  const [detailBusy, setDetailBusy] = useState(false);

  useEffect(() => {
    if (!props.isOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: query.trim().length >= 2 ? "220" : "120",
          sort: "az",
          fields: "id,name,cr,type,environment",
        });
        const data = await api<CompendiumMonsterRow[]>(`/api/compendium/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setRows([]);
        setError(e?.message ?? "Failed to load monsters.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [props.isOpen, query]);

  useEffect(() => {
    if (!props.isOpen) {
      setQuery("");
      setSelectedId(null);
      setDetail(null);
      setDetailCache({});
      setDetailBusy(false);
      setRows([]);
    }
  }, [props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || !selectedId) {
      setDetail(null);
      setDetailBusy(false);
      return;
    }
    const cached = detailCache[selectedId];
    if (cached) {
      setDetail(cached);
      setDetailBusy(false);
      return;
    }
    let alive = true;
    setDetailBusy(true);
    api<any>(`/api/compendium/monsters/${encodeURIComponent(selectedId)}`)
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        setDetailCache((prev) => ({ ...prev, [selectedId]: data }));
      })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setDetailBusy(false); });
    return () => { alive = false; };
  }, [props.isOpen, selectedId, detailCache]);

  const filteredRows = rows;

  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? rows.find((row) => row.id === selectedId) ?? null;

  if (!props.isOpen) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 8, 18, 0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ width: "min(1100px, 100%)", height: "min(720px, calc(100vh - 40px))", background: C.bg, border: `1px solid ${C.panelBorder}`, borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", display: "grid", gridTemplateColumns: "minmax(320px, 380px) minmax(0, 1fr)", gap: 12, padding: 12, overflow: "hidden" }}>
        <div style={inventoryPickerColumnStyle}>
          <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.colorGold }}>
            Add Creature
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search monsters..."
            style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }}
          />
          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
            {busy ? "Loading..." : error ? error : `${filteredRows.length} creature${filteredRows.length === 1 ? "" : "s"}`}
          </div>
          <div style={inventoryPickerListStyle}>
            {!busy && error ? <div style={{ padding: 12, color: C.red }}>{error}</div> : null}
            {!busy && !error && filteredRows.length === 0 ? <div style={{ padding: 12, color: C.muted }}>No creatures found.</div> : null}
            {filteredRows.map((row) => (
              <ItemListRow
                key={row.id}
                name={row.name}
                subtitle={[row.size, row.type, row.cr != null ? `CR ${row.cr}` : null].filter(Boolean).join(" • ") || null}
                active={row.id === selectedId}
                onClick={() => setSelectedId(row.id)}
                textColor={C.text}
                mutedColor={C.muted}
                borderColor={C.panelBorder}
                activeBackground={withAlpha(props.accentColor, 0.15)}
              />
            ))}
          </div>
        </div>

        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text }}>
              {selectedRow?.name ?? "Select a creature"}
            </div>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => {
                if (!selectedRow) return;
                const ac = Math.max(1, parseLeadingNumber(detail?.ac) ?? 10);
                const hpMax = Math.max(1, parseLeadingNumber(detail?.hp) ?? 1);
                props.onAdd({
                  id: uid(),
                  monsterId: selectedRow.id,
                  name: selectedRow.name,
                  friendly: true,
                  hpMax,
                  hpCurrent: hpMax,
                  ac,
                  hpDetails: null,
                  acDetails: null,
                  label: null,
                  notes: null,
                });
              }}
              disabled={!selectedRow}
              style={addBtnStyle(props.accentColor)}
            >
              Add
            </button>
            <button type="button" onClick={props.onClose} style={cancelBtnStyle}>Close</button>
          </div>

          {detailBusy ? (
            <div style={{ color: C.muted }}>Loading creature details...</div>
          ) : detail ? (
            <MonsterStatblock monster={detail} />
          ) : (
            <div style={{ color: C.muted, lineHeight: 1.5 }}>
              Pick a monster on the left to preview its stat block before adding it to the character.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
