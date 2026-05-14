import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { createMyCharacter, fetchMyCharacters } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { IconImport } from "@/icons";
import { accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";
import {
  buildCharacterCreatePayload,
  readLastOpened,
  touchLastOpened,
  type Campaign,
  type UserCharacter,
} from "./PlayerHomeUtils";
import { CharacterRow } from "./PlayerHomeCharacterRow";
import { CampaignCard } from "./PlayerHomeCampaignCard";

export function PlayerHomeView() {
  const navigate = useNavigate();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>(readLastOpened);

  const reload = useCallback(() => {
    return Promise.all([
      api<Campaign[]>("/api/me/campaigns"),
      fetchMyCharacters(),
    ]).then(([camps, chars]) => {
      setCampaigns(camps);
      setCharacters(chars as UserCharacter[]);
    });
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [reload]);

  function openCharacter(id: string) {
    touchLastOpened(id);
    setLastOpened(readLastOpened());
    navigate(`/characters/${id}`);
  }

  function openCampaign(id: string) {
    touchLastOpened(id);
    setLastOpened(readLastOpened());
    navigate(`/campaigns/${id}`);
  }

  const sortedCharacters = useMemo(() =>
    [...characters].sort((a, b) => (lastOpened[b.id] ?? 0) - (lastOpened[a.id] ?? 0)),
  [characters, lastOpened]);

  const sortedCampaigns = useMemo(() =>
    [...campaigns].sort((a, b) => (lastOpened[b.id] ?? 0) - (lastOpened[a.id] ?? 0)),
  [campaigns, lastOpened]);

  async function handleImportSelected(file?: File | null) {
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    setError(null);
    try {
      const text = (await file.text()).replace(/^﻿/, "");
      const parsed = JSON.parse(text) as unknown;
      const payload = buildCharacterCreatePayload(parsed);
      await createMyCharacter(payload);
      await reload();
      setImportFile(null);
      setImportMsg("Character imported.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import character.";
      setError(`Import failed: ${message}`);
      setImportMsg(`Import failed: ${message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ height: "100%", background: C.bg, color: C.text, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <input
          ref={importFileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />

        {/* ── My Characters ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-hero)", fontWeight: 800 }}>My Characters</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label
              style={{
                padding: "7px 14px",
                borderRadius: 10,
                border: "1px solid rgba(251,191,36,0.35)",
                background: "rgba(255,255,255,0.02)",
                color: importFile ? C.text : C.muted,
                fontSize: "var(--fs-subtitle)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                maxWidth: 220,
                textOverflow: "ellipsis",
                display: "inline-block",
              }}
              title={importFile ? importFile.name : "Choose a character JSON file"}
              onClick={() => importFileRef.current?.click()}
            >
              {importFile ? importFile.name : "Choose file..."}
            </label>
            <button
              title="Import selected character file"
              aria-label="Import selected character file"
              disabled={!importFile || importing}
              style={{
                ...ghostButtonStyle({ textColor: C.colorGold, borderColor: "rgba(251,191,36,0.35)", padding: "8px 14px", fontSize: "var(--fs-subtitle)" }),
                minWidth: 100,
                opacity: !importFile || importing ? 0.6 : 1,
                cursor: !importFile || importing ? "not-allowed" : "pointer",
              }}
              onClick={() => void handleImportSelected(importFile)}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <IconImport size={14} />
                {importing ? "Importing..." : "Import"}
              </span>
            </button>
            <button
              title="Create character"
              aria-label="Create character"
              style={{
                ...accentButtonStyle(C.colorGold, { textColor: C.textDark, borderColor: "transparent", padding: "8px 12px", fontSize: "var(--fs-subtitle)" }),
                background: C.colorGold,
                minWidth: 42,
              }}
              onClick={() => navigate("/characters/new")}
            >
              +
            </button>
          </div>
        </div>

        {loading && <p style={{ color: C.muted }}>Loading…</p>}
        {error && <p style={{ color: C.red }}>{error}</p>}
        {!error && importMsg && <p style={{ color: C.muted }}>{importMsg}</p>}

        {!loading && !error && characters.length === 0 && (
          <p style={{ color: C.muted, fontSize: "var(--fs-medium)" }}>No characters yet. Create one to get started.</p>
        )}

        {!loading && characters.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
            marginBottom: 40,
          }}>
            {sortedCharacters.map((ch) => (
              <CharacterRow
                key={ch.id}
                ch={ch}
                onOpen={openCharacter}
                onRefresh={reload}
                onError={(message) => setError(message)}
              />
            ))}
          </div>
        )}

        {/* ── Your Campaigns ── */}
        {!loading && campaigns.length > 0 && (
          <>
            <h2 style={{ margin: "0 0 20px", fontSize: "var(--fs-hero)", fontWeight: 800 }}>My Campaigns</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 18,
            }}>
              {sortedCampaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  characters={characters}
                  onOpen={openCampaign}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
