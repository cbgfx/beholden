import React from "react";
import { useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { useWs } from "@/services/ws";
import type { PartyMember } from "./CampaignPartyView";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { abilityMod, hasNamedProficiency, normalizeSpellTrackingKey, normalizeSpellTrackingName, proficiencyBonus } from "@/views/character/CharacterSheetUtils";
import { useDebouncedSingleflight } from "@beholden/shared/ui";
import { CollectionRow, HeaderActionLink, Panel, SubsectionLabel } from "@beholden/shared/ui";
import { PartyMemberHeader } from "./PartyMemberHeader";
import { PartyMemberStatsColumn } from "./PartyMemberStatsColumn";
import { PartyMemberProficienciesColumn } from "./PartyMemberProficienciesColumn";

export interface NamedEntry {
  name: string;
}

export interface Proficiencies {
  skills?: NamedEntry[];
  expertise?: NamedEntry[];
  saves?: NamedEntry[];
  armor?: NamedEntry[];
  weapons?: NamedEntry[];
  tools?: NamedEntry[];
  languages?: NamedEntry[];
  spells?: NamedEntry[];
  invocations?: NamedEntry[];
}

export interface FeatureEntry {
  name: string;
  text?: string;
}

export interface NoteEntry {
  id: string;
  title: string;
  text: string;
}

interface CharacterClassEntry {
  subclass?: string;
}

interface CharacterDataShape {
  proficiencies?: Proficiencies;
  selectedFeatures?: Array<{ name?: string; text?: string }>;
  selectedFeatureNames?: string[];
  playerNotesList?: Array<{ id?: string; title?: string; text?: string }>;
  sharedNotes?: string | Array<{ id?: string; title?: string; text?: string }>;
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  classes?: CharacterClassEntry[];
  hd?: number;
}

function asCharacterData(value: unknown): CharacterDataShape | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CharacterDataShape;
}

function toNoteEntries(value: unknown): NoteEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((note) => {
      if (!note || typeof note !== "object") return null;
      const candidate = note as { id?: unknown; title?: unknown; text?: unknown };
      return {
        id: String(candidate.id ?? ""),
        title: String(candidate.title ?? ""),
        text: String(candidate.text ?? ""),
      };
    })
    .filter((note): note is NoteEntry => Boolean(note && note.id.length > 0));
}

function useViewportWidth() {
  const [width, setWidth] = React.useState<number>(() => (typeof window === "undefined" ? 1440 : window.innerWidth));

  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

export function PartyMemberView() {
  const { id: campaignId, playerId } = useParams<{ id: string; playerId: string }>();
  const [member, setMember] = React.useState<PartyMember | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedFeatureIds, setExpandedFeatureIds] = React.useState<Record<string, boolean>>({});
  const [expandedNoteIds, setExpandedNoteIds] = React.useState<Record<string, boolean>>({});
  const viewportWidth = useViewportWidth();

  const fetchMember = React.useCallback(() => {
    if (!campaignId || !playerId) return;
    api<PartyMember>(`/api/campaigns/${campaignId}/party/${playerId}`)
      .then((found) => {
        setMember(found);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? "Failed to load."))
      .finally(() => setLoading(false));
  }, [campaignId, playerId]);

  const enqueueFetchMember = useDebouncedSingleflight(fetchMember);

  React.useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  useWs(React.useCallback((msg) => {
    if (msg.type !== "players:delta") return;
    const payload = (msg.payload ?? {}) as {
      campaignId?: string;
      action?: "upsert" | "delete" | "refresh";
      playerId?: string;
    };
    if (payload.campaignId !== campaignId) return;
    if (payload.playerId && payload.playerId !== playerId) return;
    if (payload.action === "delete") {
      setMember(null);
      setError("Member not found.");
      setLoading(false);
      return;
    }
    enqueueFetchMember(80);
  }, [campaignId, enqueueFetchMember, playerId]));

  const cd = asCharacterData(member?.characterData);
  const prof = (cd?.proficiencies ?? undefined) as Proficiencies | undefined;

  const spellNameLookup = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of prof?.spells ?? []) {
      const normalizedName = normalizeSpellTrackingName(entry.name);
      if (!normalizedName) continue;
      map.set(normalizeSpellTrackingKey(normalizedName), normalizedName);
    }
    for (const entry of prof?.invocations ?? []) {
      const normalizedName = normalizeSpellTrackingName(entry.name);
      if (!normalizedName) continue;
      map.set(normalizeSpellTrackingKey(normalizedName), normalizedName);
    }
    return map;
  }, [prof?.invocations, prof?.spells]);

  const classFeatures: FeatureEntry[] = React.useMemo(() => {
    const detailed = Array.isArray(cd?.selectedFeatures)
      ? cd.selectedFeatures
        .map((entry) => ({
          name: String(entry?.name ?? "").trim(),
          text: typeof entry?.text === "string" ? entry.text.trim() : "",
        }))
        .filter((entry: FeatureEntry) => entry.name.length > 0)
      : [];
    if (detailed.length > 0) return detailed;
    return (cd?.selectedFeatureNames ?? []).map((name: string) => ({ name: String(name ?? "").trim() })).filter((entry: FeatureEntry) => entry.name.length > 0);
  }, [cd?.selectedFeatureNames, cd?.selectedFeatures]);

  const playerNotes: NoteEntry[] = toNoteEntries(cd?.playerNotesList);

  const sharedNotes: NoteEntry[] = React.useMemo(() => {
    if (Array.isArray(cd?.sharedNotes)) return toNoteEntries(cd.sharedNotes);
    if (typeof cd?.sharedNotes === "string" && cd.sharedNotes.trim().length > 0) {
      try {
        const parsed = JSON.parse(cd.sharedNotes);
        return toNoteEntries(parsed);
      } catch {
        return [];
      }
    }
    return [];
  }, [cd?.sharedNotes]);

  if (loading) {
    return (
      <div style={{ height: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
        Loading...
      </div>
    );
  }

  if (error || !member) {
    return (
      <div style={{ height: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.colorPinkRed }}>
        {error ?? "Not found."}
      </div>
    );
  }

  const m = member;
  const pb = proficiencyBonus(m.level);
  const color = m.color ?? C.accentHl;

  const scores: Record<AbilKey, number | null> = {
    str: m.strScore,
    dex: m.dexScore,
    con: m.conScore,
    int: m.intScore,
    wis: m.wisScore,
    cha: m.chaScore,
  };

  const passivePerc = 10 + abilityMod(m.wisScore) + (hasNamedProficiency(prof?.skills ?? [], "Perception") ? pb : 0);
  const cantrips: string[] = Array.isArray(cd?.chosenCantrips) ? cd.chosenCantrips : [];
  const spells: string[] = Array.isArray(cd?.chosenSpells) ? cd.chosenSpells : [];
  const invocations: string[] = Array.isArray(cd?.chosenInvocations) ? cd.chosenInvocations : [];

  const allNotes = [...sharedNotes, ...playerNotes];
  const isPhone = viewportWidth < 900;
  const isTablet = viewportWidth < 1220;

  const contentPadding = isPhone ? "16px 14px 32px" : "24px 24px 48px";
  const columnsTemplate = isPhone ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const headerDirection: React.CSSProperties["flexDirection"] = isPhone ? "column" : "row";
  const headerAlign: React.CSSProperties["alignItems"] = isPhone ? "flex-start" : "flex-end";
  const topStatsWidth = isPhone ? "100%" : undefined;
  const topStatsColumns = isPhone ? "repeat(3, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: contentPadding }}>
        <HeaderActionLink
          to={campaignId ? `/campaigns/${campaignId}` : "/"}
          color={C.muted}
          padding="0 0 16px"
          borderRadius={0}
          fontSize="var(--fs-small)"
        >
          {"<- Back to Party"}
        </HeaderActionLink>

        <PartyMemberHeader
          member={m}
          color={color}
          subclass={cd?.classes?.[0]?.subclass}
          headerDirection={headerDirection}
          headerAlign={headerAlign}
          topStatsWidth={topStatsWidth}
          topStatsColumns={topStatsColumns}
        />

        <div style={{ display: "grid", gridTemplateColumns: columnsTemplate, gap: 16, alignItems: "start" }}>
          <PartyMemberStatsColumn
            scores={scores}
            prof={prof}
            color={color}
            pb={pb}
            passivePerc={passivePerc}
            hitDie={cd?.hd}
          />

          <PartyMemberProficienciesColumn
            prof={prof}
            color={color}
            classFeatures={classFeatures}
            allNotes={allNotes}
            expandedFeatureIds={expandedFeatureIds}
            onToggleFeature={(id) => setExpandedFeatureIds((prev) => ({ ...prev, [id]: !prev[id] }))}
            expandedNoteIds={expandedNoteIds}
            onToggleNote={(id) => setExpandedNoteIds((prev) => ({ ...prev, [id]: !prev[id] }))}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(cantrips.length > 0 || spells.length > 0 || invocations.length > 0) ? (
              <Panel>
                <SubsectionLabel>Spells</SubsectionLabel>
                {cantrips.length > 0 ? <SpellGroup label="Cantrips" items={cantrips} color={color} lookup={spellNameLookup} /> : null}
                {spells.length > 0 ? <SpellGroup label="Spells" items={spells} color={color} lookup={spellNameLookup} /> : null}
                {invocations.length > 0 ? <SpellGroup label="Invocations" items={invocations} color={color} lookup={spellNameLookup} /> : null}
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpellGroup({ label, items, color, lookup }: { label: string; items: string[]; color: string; lookup: Map<string, string> }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: "rgba(160,180,220,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((spellId, index) => (
          <CollectionRow
            key={`${label}:${spellId}:${index}`}
            borderColor="rgba(255,255,255,0.04)"
            padding="3px 0"
            leading={<span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, opacity: 0.65 }} />}
            main={<span style={{ color: C.text, fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{formatPartySpellName(spellId, lookup)}</span>}
          />
        ))}
      </div>
    </div>
  );
}

function formatPartySpellName(raw: string, spellNameLookup: Map<string, string>): string {
  const normalized = String(raw ?? "").trim();
  if (!normalized) return "Unknown";

  const fromLookup = spellNameLookup.get(normalizeSpellTrackingKey(normalized));
  if (fromLookup) return fromLookup;

  if (/^s_[a-z0-9_]+$/i.test(normalized)) return toTitleWords(normalized.slice(2).replace(/_/g, " "));
  if (/^[a-z0-9_]+$/i.test(normalized) && normalized.includes("_")) return toTitleWords(normalized.replace(/_/g, " "));
  return normalized;
}

function toTitleWords(value: string): string {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
