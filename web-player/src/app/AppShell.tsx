import React from "react";
import { NavLink, Link } from "react-router-dom";
import { C, withAlpha } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { IconDice } from "@/icons";
import { api } from "@/services/api";
import { fetchMyCharacters } from "@/services/actorApi";
import { useWsStatus } from "@/services/ws";
import { StatusDot, FooterGrid, HeaderActionButton, HeaderActionLink, TopBarFrame, navLinkStyle } from "@beholden/shared/ui";

const DiceCalculatorModal = React.lazy(() =>
  import("@/tools/DiceCalculatorModal").then((module) => ({ default: module.DiceCalculatorModal })),
);

function readLastCharacter(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem("beholden:lastCharacter");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.name === "string") return parsed;
  } catch {}
  return null;
}

function useLastCharacter() {
  const [last, setLast] = React.useState(readLastCharacter);
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "beholden:lastCharacter") setLast(readLastCharacter());
    }
    function onCustom() { setLast(readLastCharacter()); }
    window.addEventListener("storage", onStorage);
    window.addEventListener("beholden:lastCharacter", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beholden:lastCharacter", onCustom);
    };
  }, []);
  React.useEffect(() => {
    if (!last?.id) return;
    let cancelled = false;
    fetchMyCharacters()
      .then((characters) => {
        if (cancelled) return;
        const stillExists = characters.some((character) => character.id === last.id);
        if (stillExists) return;
        localStorage.removeItem("beholden:lastCharacter");
        setLast(null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [last?.id]);
  return last;
}

interface Meta {
  support: boolean;
}

function useServerMeta() {
  const [meta, setMeta] = React.useState<Meta | null>(null);
  React.useEffect(() => {
    api<Meta>("/api/meta").then(setMeta).catch(() => {});
  }, []);
  return meta;
}

function useUpdateCheck() {
  const [state, setState] = React.useState({ currentVersion: "1.4.0", updateAvailable: false });
  const [updating, setUpdating] = React.useState(false);
  const [message, setMessage] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    const checkForUpdate = () => {
      api<{ ok: boolean; currentVersion?: string; updateAvailable?: boolean }>("/api/update-check")
        .then((r) => {
          if (!cancelled) setState({ currentVersion: r.currentVersion ?? "1.4.0", updateAvailable: r.ok && r.updateAvailable === true });
        })
        .catch(() => {});
    };

    const idleId = window.requestIdleCallback?.(checkForUpdate, { timeout: 3_000 });
    const timeoutId = idleId === undefined ? window.setTimeout(checkForUpdate, 1_500) : undefined;
    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);
  const startUpdate = React.useCallback(async () => {
    if (!window.confirm("Pull and build the latest Beholden release now?")) return;
    setUpdating(true);
    try {
      const result = await api<{ message?: string }>("/api/update", { method: "POST" });
      setMessage(result.message ?? "Update started. Restart Beholden when it finishes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the update.");
    } finally {
      setUpdating(false);
    }
  }, []);
  return { ...state, updating, message, startUpdate };
}

function topbarToolButtonStyle(active = false, accent = C.accentHl, muted = C.muted): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 9,
    border: `1px solid ${active ? withAlpha(accent, 0.55) : C.panelBorder}`,
    background: active ? withAlpha(accent, 0.14) : "rgba(255,255,255,0.04)",
    color: active ? accent : muted,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };
}


export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const meta = useServerMeta();
  const update = useUpdateCheck();
  const showSupport = meta?.support === true;
  const connected = useWsStatus();
  const lastChar = useLastCharacter();
  const [diceOpen, setDiceOpen] = React.useState(false);
  // Keep the calculator mounted after its first open so its own expression/result state
  // (DiceCalculatorModal's internal useState) survives close/reopen, same as before it was
  // lazy-loaded — only the first open should trigger the dynamic import.
  const [diceEverOpened, setDiceEverOpened] = React.useState(false);
  React.useEffect(() => {
    if (diceOpen) setDiceEverOpened(true);
  }, [diceOpen]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <TopBarFrame height="auto" padding="8px 16px" gap={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
            alignItems: "center",
            columnGap: 10,
            width: "100%",
          }}
        >
          {/* Left: logo + role badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(251,191,36,0.42)",
                  background: "linear-gradient(180deg, rgba(251,191,36,0.14), rgba(255,255,255,0.02))",
                  boxShadow: "0 10px 22px rgba(251,191,36,0.16)",
                }}
              >
                <img src={`${import.meta.env.BASE_URL}beholden_logo.png`} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
              </span>
              <span style={{ fontSize: "var(--fs-hero)", fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
                Beholden
              </span>
            </Link>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 8,
                border: `1px solid ${withAlpha(C.accentHl, 0.4)}`,
                background: withAlpha(C.accentHl, 0.1),
                color: C.accentHl,
                fontWeight: 700,
                fontSize: "var(--fs-medium)",
                flexShrink: 0,
              }}
            >
              Player
            </span>
          </div>

          {/* Center: tools */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "0 8px",
              borderLeft: `1px solid ${C.panelBorder}`,
              borderRight: `1px solid ${C.panelBorder}`,
            }}
          >
            <button
              type="button"
              aria-label="Open dice calculator"
              title="Dice Calculator"
              onPointerDown={(e) => { e.preventDefault(); setDiceOpen(true); }}
              onClick={() => setDiceOpen(true)}
              style={topbarToolButtonStyle(diceOpen)}
            >
              <IconDice size={22} />
            </button>
          </div>

          {/* Right: nav + user */}
          <div
            style={{
              justifySelf: "end",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: C.muted,
              fontSize: "var(--fs-medium)",
            }}
          >
            <nav style={{ display: "flex", gap: 4 }}>
              <NavLink to="/" end style={({ isActive }) => navLinkStyle(isActive, C.accentHl, C.muted)}>
                Home
              </NavLink>
              {lastChar && (
                <NavLink
                  to={`/characters/${lastChar.id}`}
                  style={({ isActive }) => navLinkStyle(isActive, C.accentHl, C.muted)}
                >
                  {lastChar.name}
                </NavLink>
              )}
              <NavLink to="/compendium" style={({ isActive }) => navLinkStyle(isActive, C.accentHl, C.muted)}>
                Compendium
              </NavLink>
            </nav>
            <HeaderActionLink to="/profile" color={C.muted}>
              {user?.name || user?.username}
            </HeaderActionLink>
            <HeaderActionButton onClick={logout} color={C.muted} borderColor={C.panelBorder}>
              Sign out
            </HeaderActionButton>
            <StatusDot
              active={connected}
              activeColor={C.green}
              inactiveColor={C.red}
              title={connected ? "Server connected" : "Server disconnected"}
            />
          </div>
        </div>
      </TopBarFrame>
      {diceEverOpened && (
        <React.Suspense fallback={null}>
          <DiceCalculatorModal isOpen={diceOpen} onClose={() => setDiceOpen(false)} />
        </React.Suspense>
      )}

      <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {children}
      </main>

      <FooterGrid
        borderColor={C.panelBorder}
        background={withAlpha(C.panelBg, 0.12)}
        color={C.muted}
        left={
          <>
            <div>© {new Date().getFullYear()} Beholden. All rights reserved.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span>Icons made by</span>
              <a target="_blank" rel="noreferrer" href="https://game-icons.net" style={{ color: C.muted }}>
                https://game-icons.net
              </a>
            </div>
          </>
        }
        centerLeft={
          <>
            <Link to="/about" style={{ color: C.accent, textDecoration: "none" }}>About</Link>
            <Link to="/faq" style={{ color: C.accent, textDecoration: "none" }}>FAQ</Link>
            <Link to="/updates" style={{ color: C.accent, textDecoration: "none" }}>Future Updates</Link>
          </>
        }
        centerRight={showSupport ? (
          <a
            href="https://www.buymeacoffee.com/beholden"
            target="_blank"
            rel="noreferrer"
            title="Support Beholden"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${withAlpha(C.colorGold, 0.45)}`,
              background: withAlpha(C.colorGold, 0.12),
              color: C.colorGold,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Support Beholden
          </a>
        ) : null}
        right={
          <>
            {update.updateAvailable && (user?.isAdmin ? (
              <button type="button" onClick={update.startUpdate} disabled={update.updating} style={{ border: 0, padding: 0, background: "none", cursor: "pointer", color: C.accent, fontWeight: 600 }}>
                {update.updating ? "Starting update…" : "Update Available"}
              </button>
            ) : <span style={{ color: C.accent, fontWeight: 600 }}>Update Available</span>)}
            {update.message && <div>{update.message}</div>}
            <div>v{update.currentVersion}</div>
          </>
        }
      />
    </div>
  );
}
