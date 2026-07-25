import React from "react";
import { useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { IconBastions, IconPlayer } from "@/icons";
import { CharacterHudXpPopup } from "@/views/character/CharacterHudXpPopup";
import { stripEditionTag } from "@/views/character/CharacterViewHelpers";

export type SheetView = "play" | "gear" | "reference" | "all";

export const SHEET_VIEWS: { id: SheetView; label: string; description: string }[] = [
  { id: "play", label: "Combat", description: "Character, actions, and upkeep" },
  { id: "gear", label: "Gear", description: "Character and inventory" },
  { id: "reference", label: "Reference", description: "Character, notes, and features" },
  { id: "all", label: "All", description: "The complete four-column sheet" },
];

function IconCharacterInfo({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M453.295 17.117c-.546 7.232 1.619 15.478 5.957 22.612 4.338 7.133 10.666 12.847 17.338 15.69 9.655-11.206-5.483-37.974-20.092-38.624-1.09-.07-2.254.137-3.203.322zm-111.547 8.38L329.492 49.61l61.018 100.326 25.627-2.127 13.676-21.777-9.063-14.9-27.34 16.628-37.931-62.371L350.8 57.7l27.34-16.628-9.346-15.368zm93.977 1.62-60.194 36.61 23.905 39.303 60.193-36.61c-6.345-4.604-11.676-10.635-15.754-17.34-4.078-6.704-6.981-14.21-8.15-21.963zm-125.01 19.711-161.647 2.62c10.403 24.036 7.492 47.197-4.388 65.648-18.658-14.237-44.341-15.374-63.407-17.717-14.06 123.827-6.22 225.967-6.271 342.149-.004 9.469-1.157 23.12 4.826 32.947 1.887 3.1 4.37 5.928 8.129 8.342 17.708-6.206 41.405-12.24 54.87-22.274-6.951-.825-14.755.952-21.138.955-8.458-.04-19.144-6.11-24.748-19.496-2.919-6.973-6.636-18.193-.181-29.072 2.838-4.785 9.383-10.302 14.26-10.328 94.651.504 191.392-.32 279.568.154-5.523-76.851-10.013-154.096-5.53-232.308l-4.146.343-14.842-24.404-66.867 40.668 6.781 10.598-15.162 9.699-59.097-92.371 15.16-9.7L255 115.966l68.46-41.637-11.95-19.65-2.606-4.285zm-180.17 4.383c-15.366 8.213-29.102 17.702-40.99 28.707 16.167 1.495 33.74 3.063 48.64 9.95 3.139-13.836-3.247-26.896-7.65-38.657zm202.268 38.494-66.645 40.534 7.275 11.962 33.325-20.265 9.351 15.377-33.322 20.267 7.277 11.963 66.643-40.533zM201.41 136.278l.445 17.992c-30.522.253-58.62 2.029-90.013 2.11v-18a35163.72 35163.72 0 0 0 89.568-2.103zm144.983 78.98.24 17.996-234.346 3.143-.242-17.996zm.078 40.684.408 17.992-123.654 2.81-.41-17.994zm-235.178 3.097h90.602v17.998h-90.602zm234.795 33.237.406 17.992-62.158 1.406-.406-17.994zm-83.686 1.455.338 17.996-150.3 2.808-.337-17.994zm85.946 52.806.402 17.995-125.647 2.808-.402-17.992zm-196.323 70.79c10.05 9.261 17.925 22.065 15.078 36.718-2.074 10.682-10.422 17.606-19.814 23.106s-20.775 9.866-32.512 13.914a1395.68 1395.68 0 0 1-12.238 4.154l301.387-7.672c7.772-.45 14.658-5.66 19.734-13.406 5.082-7.754 7.477-17.817 6.895-23.236-.583-5.419-4.857-14.677-10.973-21.48-6.116-6.805-13.547-10.824-19.025-10.618l-.198.008zm-39.785 2.787c-1.07 1.802-.466 8.714 1.303 12.939 3.72 8.887 6.028 8.437 8.232 8.447 8.877 2.102 17.347.269 25.85-1.025-2.053-4.123-5.283-8.704-10.283-12.113-4.12-2.809-20.675-15.634-25.102-8.248z" />
    </svg>
  );
}

/** Dark Squad by Lorc, CC BY 3.0 — https://game-icons.net/1x1/lorc/dark-squad.html */
function IconEngagedEnemies({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M369.1 21.22c-19.2 0-36.2 10.63-47.9 26.47-11.7 15.84-18.6 37.03-18.6 60.31 0 21.1 5.7 40.5 15.5 55.7-5.7 1.6-11 3.9-15.9 6.6-10.2-8.5-22.6-13.6-35.9-13.6-19.3 0-36.3 10.6-48 26.4-4.7 6.4-8.6 13.6-11.6 21.5-4.8-2.4-9.9-4.3-15.5-5.6 9.4-15.1 14.8-34.1 14.8-54.7 0-23.2-6.9-44.43-18.6-60.27-11.7-15.84-28.7-26.5-47.9-26.5s-36.2 10.66-47.94 26.5C79.87 99.87 73 121.1 73 144.3c0 21.1 5.69 40.5 15.47 55.8-32.07 9.1-50.29 37.1-59.44 70-9.79 35.2-10.87 77.3-10.87 115.6v9.4h45.5l6.78 99.3h18.75l-7.28-106.5-4.1-80-18.65 1 3.47 67.5H36.97c.24-35.2 1.97-72.1 10.09-101.2 8.78-31.6 23.32-52.8 51.25-58.2l4.69-.1c10.3 8.8 22.9 14.2 36.5 14.2 14.1 0 26.9-5.7 37.4-15h4.6c7.8 1.2 14.4 3.5 20.1 6.7-1.2 6.6-1.9 13.5-1.9 20.6 0 21.1 5.7 40.5 15.5 55.8-32.1 9.1-50.3 37.2-59.4 70-9.8 35.2-10.9 77.3-10.9 115.6v9.4c21.7-.3 42.8.2 64.3.2l-.5-7.3-4.1-80-18.7.9 3.4 67.5h-25.6c.3-35.2 2-72.1 10.1-101.2 8.7-31.6 23.3-52.7 51.1-58.2l4.9-.1c10.3 8.8 22.8 14.2 36.4 14.2 14.1 0 27-5.7 37.5-15h4.4c15.4 2.4 26.1 8.9 34.5 18.6 8.5 9.7 14.5 23.2 18.5 39.2 7.3 29.5 7.7 66.9 7.7 102.5h-23.4l3.5-67.5-18.7-.9-4.2 82-.3 5.3c20.8 0 43.3-.3 61.9-.2v-9.4c0-38.1.5-80.6-8.4-116.3-4.4-17.8-11.3-34.1-22.4-47-9.7-11.1-22.7-19.4-38.8-23.4 9.4-15.1 14.7-34.1 14.7-54.7 0-22.5-6.4-43.2-17.5-58.8 3.9-1.8 8.1-3.1 12.7-4h4.7c10.3 8.8 22.9 14.2 36.5 14.2 14.1 0 27-5.8 37.4-15l4.6-.1c15.4 2.5 26 8.9 34.4 18.6 8.5 9.8 14.5 23.3 18.5 39.3 7.3 29.4 7.7 66.8 7.7 102.4h-23.4l3.5-67.4-18.7-1-4.1 79.7-8.6 143.1h18.7l8.2-135.7h43.1v-9.3c0-38.2.6-80.7-8.3-116.3-4.5-17.9-11.4-34.2-22.5-47-9.6-11.2-22.6-19.5-38.8-23.5 9.4-15.1 14.8-34 14.8-54.6 0-23.28-6.9-44.47-18.6-60.31-11.6-15.29-31.5-26.13-47.9-26.47z" />
    </svg>
  );
}

export function CharacterSheetHeader(props: {
  character: { id: string; name: string; imageUrl: string | null; level: number };
  identityLabels: string[];
  campaigns: Array<{ campaignId: string; campaignName: string }>;
  accentColor: string;
  portraitUploading: boolean;
  onSelectPortrait: () => void;
  onOpenInfo: () => void;
  onOpenEngagedEnemies: () => void;
  showEngagedEnemies: boolean;
  sheetView: SheetView;
  onSheetViewChange: (view: SheetView) => void;
  activeBastion: { id: string; name: string; campaignId: string } | null;
  xpEarned: number;
  xpNeeded: number;
  xpInput: string;
  xpPopupOpen: boolean;
  setXpInput: (value: string) => void;
  setXpPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveXp: (value: number) => Promise<void>;
}) {
  const navigate = useNavigate();
  const {
    character,
    identityLabels,
    campaigns,
    accentColor,
    portraitUploading,
    onSelectPortrait,
    onOpenInfo,
    onOpenEngagedEnemies,
    showEngagedEnemies,
    sheetView,
    onSheetViewChange,
    activeBastion,
    xpEarned,
    xpNeeded,
    xpInput,
    xpPopupOpen,
    setXpInput,
    setXpPopupOpen,
    saveXp,
  } = props;

  return (
    <nav
      aria-label="Character sheet sections"
      style={{
        position: "sticky", top: 0, zIndex: 30,
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: 14, padding: "5px 8px",
        border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
        background: "rgba(10,18,33,0.92)", backdropFilter: "blur(14px)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onSelectPortrait}
          title="Change portrait"
          style={{
            width: 58, height: 58, borderRadius: 14, flexShrink: 0, padding: 0,
            background: `${accentColor}18`,
            border: `2px solid ${accentColor}80`,
            boxShadow: `0 0 20px ${accentColor}38, 0 4px 16px rgba(0,0,0,0.4)`,
            overflow: "hidden", cursor: "pointer", position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {character.imageUrl
            ? <img src={character.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconPlayer size={28} style={{ opacity: 0.35 }} />}
          {portraitUploading && (
            <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-tiny)", color: "#fff" }}>…</span>
          )}
        </button>
        <div style={{ minWidth: 0 }}>
          <div>
            <span style={{
              fontWeight: 900, fontSize: "var(--fs-title)", color: C.text,
              textShadow: `0 0 24px ${accentColor}55`,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280,
              display: "block",
            }}>
              {character.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px 5px", flexWrap: "nowrap", marginTop: 3 }}>
            {identityLabels.map((item, index) => (
              <React.Fragment key={`${item}:${index}`}>
                <span style={{ fontSize: "var(--fs-small)", color: `${accentColor}bb`, whiteSpace: "nowrap" }}>{stripEditionTag(item)}</span>
                {index < identityLabels.length - 1 && <span style={{ fontSize: "var(--fs-small)", color: `${accentColor}50` }}>·</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        <button type="button" onClick={onOpenInfo} title="Character Information" style={{ width: 40, height: 32, padding: 0, borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconCharacterInfo size={19} />
        </button>
        {showEngagedEnemies && (
          <button type="button" onClick={onOpenEngagedEnemies} title="Engaged Enemies" aria-label="Open engaged enemies" style={{ width: 40, height: 32, padding: 0, borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconEngagedEnemies size={20} />
          </button>
        )}
        <button type="button" title="Edit character" onClick={() => navigate(`/characters/${character.id}/edit`)} style={{ appearance: "none", cursor: "pointer", fontFamily: "inherit", height: 32, padding: "0 16px", borderRadius: 8, color: C.muted, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", fontSize: "var(--fs-medium)", fontWeight: 700, flexShrink: 0 }}>
          Edit
        </button>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 3, padding: 3, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {SHEET_VIEWS.map((view) => {
          const selected = sheetView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={selected}
              title={view.description}
              onClick={() => onSheetViewChange(view.id)}
              style={{
                appearance: "none", cursor: "pointer", boxSizing: "border-box",
                border: 0, fontFamily: "inherit", padding: "5px 13px", borderRadius: 7,
                color: selected ? "#eaf7ff" : C.muted,
                background: selected ? `${accentColor}24` : "transparent",
                boxShadow: selected ? `inset 0 0 0 1px ${accentColor}55` : "none",
                fontSize: "var(--fs-small)", fontWeight: selected ? 800 : 650,
                transition: "background 120ms ease, color 120ms ease, box-shadow 120ms ease",
              }}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />
              {campaigns.map((campaign) => (
          <button
            key={campaign.campaignId}
            type="button"
            title={`Open campaign: ${campaign.campaignName}`}
            onClick={() => navigate(`/campaigns/${campaign.campaignId}`)}
            style={{
              appearance: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              height: 32,
              maxWidth: 220,
              padding: "0 11px",
              borderRadius: 8,
              color: C.text,
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}42`,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <span style={{ color: accentColor, fontSize: "var(--fs-small)", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {campaign.campaignName}
            </span>
          </button>
        ))}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {activeBastion && (
          <button type="button" title={`Bastion: ${activeBastion.name}`} onClick={() => navigate(`/campaigns/${activeBastion.campaignId}/bastions/${activeBastion.id}`)} style={{ appearance: "none", cursor: "pointer", boxSizing: "border-box", height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: C.muted, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "var(--fs-medium)", fontWeight: 700 }}>
            <IconBastions size={19} />
            {activeBastion.name}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 800, color: accentColor, whiteSpace: "nowrap" }}>Lv {character.level}</span>
          {xpEarned >= xpNeeded && xpNeeded > 0 && (
            <button type="button" title="Level up" onClick={() => navigate(`/characters/${character.id}/levelup`)} style={{ padding: "2px 7px", borderRadius: 6, cursor: "pointer", flexShrink: 0, background: `${accentColor}22`, border: `1px solid ${accentColor}66`, color: accentColor, fontWeight: 700, fontSize: "var(--fs-tiny)" }}>↑</button>
          )}
        </div>
        <CharacterHudXpPopup
          xpEarned={xpEarned}
          xpNeeded={xpNeeded}
          xpInput={xpInput}
          xpPopupOpen={xpPopupOpen}
          setXpInput={setXpInput}
          setXpPopupOpen={setXpPopupOpen}
          saveXp={saveXp}
          accentColor={accentColor}
        />
      </div>
    </nav>
  );
}
