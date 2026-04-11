import React from "react";
import { useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { IconPlayer, IconShield, IconSpeed, IconInitiative, IconHeart, IconConditionByKey } from "@/icons";
import { useWs } from "@/services/ws";
import type { PartyMember } from "./CampaignPartyView";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { ABILITY_LABELS, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import { abilityMod, formatModifier, hasNamedProficiency, hpColor, normalizeSpellTrackingKey, normalizeSpellTrackingName, proficiencyBonus } from "@/views/character/CharacterSheetUtils";
import { CollapsiblePanel } from "@/views/character/CharacterViewParts";
import { CollectionRow, HeaderActionLink, MiniStat, NoteRow, Panel, SubsectionLabel, Tag } from "@beholden/shared/ui";

interface NamedEntry {
  name: string;
}

interface Proficiencies {
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

interface FeatureEntry {
  name: string;
  text?: string;
}

interface NoteEntry {
  id: string;
  title: string;
  text: string;
}

const MINI_STAT_THEME = {
  mutedColor: C.muted,
  textColor: C.text,
  borderColor: "rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.05)",
};

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
  const refreshTimerRef = React.useRef<number | null>(null);
  const refreshInflightRef = React.useRef(false);
  const refreshPendingRef = React.useRef(false);

  const fetchMember = React.useCallback(() => {
    if (!campaignId) return;
    api<PartyMember[]>(`/api/campaigns/${campaignId}/party`)
      .then((list) => {
        const found = list.find((entry) => entry.id === playerId);
        if (found) {
          setMember(found);
          setError(null);
        } else {
          setError("Member not found.");
        }
      })
      .catch((e) => setError(e?.message ?? "Failed to load."))
      .finally(() => setLoading(false));
  }, [campaignId, playerId]);

  const enqueueFetchMember = React.useCallback((delayMs = 150) => {
    if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      const run = () => {
        if (refreshInflightRef.current) {
          refreshPendingRef.current = true;
          return;
        }
        refreshInflightRef.current = true;
        Promise.resolve(fetchMember())
          .catch(() => {})
          .finally(() => {
            refreshInflightRef.current = false;
            if (refreshPendingRef.current) {
              refreshPendingRef.current = false;
              run();
            }
          });
      };
      run();
    }, delayMs);
  }, [fetchMember]);

  React.useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  React.useEffect(() => {
    return () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  useWs(React.useCallback((msg) => {
    if (msg.type !== "players:changed") return;
    const changedCampaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (changedCampaignId === campaignId) enqueueFetchMember();
  }, [campaignId, enqueueFetchMember]));

  const cd = (member?.characterData as any) ?? null;
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
        .map((entry: any) => ({
          name: String(entry?.name ?? "").trim(),
          text: typeof entry?.text === "string" ? entry.text.trim() : "",
        }))
        .filter((entry: FeatureEntry) => entry.name.length > 0)
      : [];
    if (detailed.length > 0) return detailed;
    return (cd?.selectedFeatureNames ?? []).map((name: string) => ({ name: String(name ?? "").trim() })).filter((entry: FeatureEntry) => entry.name.length > 0);
  }, [cd?.selectedFeatureNames, cd?.selectedFeatures]);

  const playerNotes: NoteEntry[] = Array.isArray(cd?.playerNotesList)
    ? cd.playerNotesList.map((note: any) => ({
      id: String(note?.id ?? ""),
      title: String(note?.title ?? ""),
      text: String(note?.text ?? ""),
    })).filter((note: NoteEntry) => note.id.length > 0)
    : [];

  const sharedNotes: NoteEntry[] = React.useMemo(() => {
    if (Array.isArray(cd?.sharedNotes)) {
      return cd.sharedNotes
        .map((note: any) => ({ id: String(note?.id ?? ""), title: String(note?.title ?? ""), text: String(note?.text ?? "") }))
        .filter((note: NoteEntry) => note.id.length > 0);
    }
    if (typeof cd?.sharedNotes === "string" && cd.sharedNotes.trim().length > 0) {
      try {
        const parsed = JSON.parse(cd.sharedNotes);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((note: any) => ({ id: String(note?.id ?? ""), title: String(note?.title ?? ""), text: String(note?.text ?? "") }))
          .filter((note: NoteEntry) => note.id.length > 0);
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
  const hpC = hpColor(m.hpPercent);

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

        <div
          style={{
            display: "flex",
            gap: 20,
            flexDirection: headerDirection,
            alignItems: headerAlign,
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 14,
              flexShrink: 0,
              background: `${color}18`,
              border: `2px solid ${color}44`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {m.imageUrl
              ? <img src={m.imageUrl} alt={m.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <IconPlayer size={36} style={{ opacity: 0.3 }} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 900, letterSpacing: -0.5 }}>
                {m.characterName || "Unnamed"}
              </h2>
              <Tag label={`Level ${m.level}`} color={color} />
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 3 }}>
              {[m.className, cd?.classes?.[0]?.subclass, m.species].filter(Boolean).join(" - ")}
            </div>
            {m.playerName ? (
              <div style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.35)", marginTop: 2 }}>{m.playerName}</div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: topStatsColumns, gap: 8, flexShrink: 0, width: topStatsWidth }}>
            <MiniStat label="AC" value={String(m.ac)} icon={<IconShield size={11} />} theme={MINI_STAT_THEME} />
            <MiniStat label="Init" value={formatModifier(abilityMod(m.dexScore))} icon={<IconInitiative size={11} />} theme={MINI_STAT_THEME} />
            <MiniStat label="Speed" value={m.speed ? `${m.speed}ft` : "--"} icon={<IconSpeed size={11} />} theme={MINI_STAT_THEME} />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: "var(--fs-small)", display: "flex", alignItems: "center", gap: 5, color: hpC, fontWeight: 700 }}>
              <IconHeart size={11} /> Hit Points
            </span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted, fontWeight: 600 }}>{m.hpPercent}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 4, width: `${m.hpPercent}%`, background: hpC, transition: "width 0.5s ease" }} />
          </div>
        </div>

        {m.conditions.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {m.conditions.map((condition, index) => (
              <span
                key={`${String((condition as any).key)}:${index}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "var(--fs-small)",
                  padding: "3px 9px",
                  borderRadius: 20,
                  fontWeight: 600,
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  color: "#fca5a5",
                }}
              >
                <IconConditionByKey condKey={(condition as any).key} size={10} />
                {String((condition as any).key)}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: columnsTemplate, gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Panel>
              <SubsectionLabel>Ability Scores</SubsectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {(Object.keys(ABILITY_LABELS) as AbilKey[]).map((ability) => {
                  const score = scores[ability];
                  const mod = abilityMod(score);
                  const saveProf = hasNamedProficiency(prof?.saves ?? [], ABILITY_LABELS[ability]);
                  return (
                    <div
                      key={ability}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                        padding: "8px 4px",
                        border: saveProf ? `1px solid ${color}33` : "1px solid transparent",
                      }}
                    >
                      <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: "rgba(160,180,220,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {ABILITY_LABELS[ability]}
                      </span>
                      <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: C.text, lineHeight: 1.1, margin: "2px 0" }}>
                        {score ?? "--"}
                      </span>
                      <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: saveProf ? color : C.muted }}>
                        {formatModifier(saveProf ? mod + pb : mod)}
                        {saveProf ? <span style={{ marginLeft: 2, fontSize: "var(--fs-tiny)" }}>*</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <SubsectionLabel>Stats</SubsectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                <MiniStat label="Prof" value={`+${pb}`} accent={color} theme={MINI_STAT_THEME} />
                <MiniStat label="Pass. Perc" value={String(passivePerc)} theme={MINI_STAT_THEME} />
                <MiniStat label="Hit Die" value={cd?.hd ? `d${cd.hd}` : "--"} theme={MINI_STAT_THEME} />
              </div>
            </Panel>

            {prof?.skills && prof.skills.length > 0 ? (
              <CollapsiblePanel title="Skills" color={color} storageKey="party-member-skills" defaultOpen>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 2 }}>
                  {ALL_SKILLS.map(({ name, abil }) => {
                    const isProficient = hasNamedProficiency(prof.skills ?? [], name);
                    const isExpertise = hasNamedProficiency(prof.expertise ?? [], name);
                    const bonus = abilityMod(scores[abil]) + (isExpertise ? pb * 2 : isProficient ? pb : 0);
                    return (
                      <div
                        key={name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 4px",
                          borderRadius: 4,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: isProficient ? (isExpertise ? color : C.green) : "transparent",
                            border: `1.5px solid ${isProficient ? (isExpertise ? color : C.green) : "rgba(255,255,255,0.2)"}`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "var(--fs-tiny)",
                            fontWeight: 700,
                            color: "rgba(160,180,220,0.45)",
                            letterSpacing: "0.04em",
                            width: 24,
                            textAlign: "center",
                          }}
                        >
                          {ABILITY_LABELS[abil]}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--fs-small)",
                            color: isProficient ? C.text : C.muted,
                            flex: 1,
                            fontWeight: isProficient ? 600 : 400,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {name}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--fs-subtitle)",
                            fontWeight: 700,
                            minWidth: 26,
                            textAlign: "right",
                            color: isExpertise ? color : isProficient ? C.green : C.text,
                          }}
                        >
                          {formatModifier(bonus)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CollapsiblePanel>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(prof?.armor?.length || prof?.weapons?.length || prof?.tools?.length || prof?.languages?.length) ? (
              <Panel>
                <SubsectionLabel>Proficiencies</SubsectionLabel>
                {[
                  { label: "Armor", items: prof?.armor },
                  { label: "Weapons", items: prof?.weapons },
                  { label: "Tools", items: prof?.tools },
                  { label: "Languages", items: prof?.languages },
                ].map(({ label, items }) => (items && items.length > 0 ? (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: "rgba(160,180,220,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                      {label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {items.map((item) => <Tag key={`${label}:${item.name}`} label={item.name} color={color} />)}
                    </div>
                  </div>
                ) : null))}
              </Panel>
            ) : null}

            {classFeatures.length > 0 ? (
              <Panel>
                <SubsectionLabel>Class Features</SubsectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {classFeatures.map((feature, index) => {
                    const id = `feature:${index}:${feature.name}`;
                    const expanded = Boolean(expandedFeatureIds[id]);
                    return (
                      <NoteRow
                        key={id}
                        title={feature.name}
                        text={feature.text ?? ""}
                        expanded={expanded}
                        accentColor={color}
                        textColor={C.text}
                        mutedColor={C.muted}
                        deleteColor={C.colorPinkRed}
                        onToggle={() => setExpandedFeatureIds((prev) => ({ ...prev, [id]: !prev[id] }))}
                      />
                    );
                  })}
                </div>
              </Panel>
            ) : null}

            {allNotes.length > 0 ? (
              <Panel>
                <SubsectionLabel>Notes</SubsectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {allNotes.map((note) => {
                    const expanded = Boolean(expandedNoteIds[note.id]);
                    return (
                      <NoteRow
                        key={note.id}
                        title={note.title || "Untitled"}
                        text={note.text}
                        expanded={expanded}
                        accentColor={color}
                        textColor={C.text}
                        mutedColor={C.muted}
                        deleteColor={C.colorPinkRed}
                        onToggle={() => setExpandedNoteIds((prev) => ({ ...prev, [note.id]: !prev[note.id] }))}
                      />
                    );
                  })}
                </div>
              </Panel>
            ) : null}
          </div>

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
