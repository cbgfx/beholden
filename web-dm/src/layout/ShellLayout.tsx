import React from "react";
import { Link } from "react-router-dom";
import { theme, withAlpha } from "@/theme/theme";
import { useStore } from "@/store";
import { TopBar } from "@/layout/TopBar";
import { api } from "@/services/api";
import { FooterGrid, TopBarFrame } from "@beholden/shared/ui";
import { useAuth } from "@/contexts/AuthContext";

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

export function ShellLayout(props: { children: React.ReactNode }) {
  const { state } = useStore();
  const { user } = useAuth();

  function parseBool(v: unknown): boolean | undefined {
    if (typeof v === "boolean") return v;
    if (typeof v !== "string") return undefined;
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
    return undefined;
  }

  const supportFromMeta = state.meta?.support;
  const supportFromVite = parseBool((import.meta as any).env?.VITE_BEHOLDEN_SUPPORT);
  const showSupport = (supportFromVite ?? supportFromMeta ?? false) === true;

  const update = useUpdateCheck();
  const ips = state.meta?.ips ?? [];
  const lanIps = ips.filter((ip) => ip.startsWith("192.168."));
  const primaryIp = lanIps[0] ?? null;
  const otherIps = ips.filter((ip) => ip !== primaryIp);

  return (
    <div
      style={{
        background: theme.colors.bg,
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with shared top-bar chrome */}
      <TopBarFrame
        height="auto"
        padding="8px 16px"
        gap={10}
        innerStyle={{ flexWrap: "wrap" }}
      >
        <TopBar />
      </TopBarFrame>

      {/* Scrollable content */}
      <div className="shellLayout" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {props.children}
      </div>

      <FooterGrid
        borderColor={theme.colors.panelBorder}
        background={withAlpha(theme.colors.panelBg, 0.12)}
        color={theme.colors.muted}
        left={
          <>
            <div>© {new Date().getFullYear()} Beholden. All rights reserved.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span>Icons made by</span>
              <a target="_blank" rel="noreferrer" href="https://game-icons.net" style={{ color: theme.colors.muted }}>
                https://game-icons.net
              </a>
            </div>
          </>
        }
        centerLeft={
          <>
            <Link to="/about" style={{ color: theme.colors.accentPrimary, textDecoration: "none" }}>About</Link>
            <Link to="/faq" style={{ color: theme.colors.accentPrimary, textDecoration: "none" }}>FAQ</Link>
            <Link to="/updates" style={{ color: theme.colors.accentPrimary, textDecoration: "none" }}>Future Updates</Link>
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
              border: `1px solid ${withAlpha(theme.colors.colorGold, 0.45)}`,
              background: withAlpha(theme.colors.colorGold, 0.12),
              color: theme.colors.colorGold,
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
              <button type="button" onClick={update.startUpdate} disabled={update.updating} style={{ border: 0, padding: 0, background: "none", cursor: "pointer", color: theme.colors.accentPrimary, fontWeight: 600 }}>
                {update.updating ? "Starting update…" : "Update Available"}
              </button>
            ) : <span style={{ color: theme.colors.accentPrimary, fontWeight: 600 }}>Update Available</span>)}
            {update.message && <div>{update.message}</div>}
            {primaryIp && (
              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                <code>http://{primaryIp}:{state.meta?.port}</code>
                <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
                  {otherIps.length > 0 && (
                    <details>
                      <summary style={{ cursor: "pointer", userSelect: "none" }}>more</summary>
                      <div style={{ marginTop: 6, display: "grid", gap: 4, justifyItems: "end" }}>
                        {otherIps.map((ip) => (
                          <code key={ip}>http://{ip}:{state.meta?.port}</code>
                        ))}
                      </div>
                    </details>
                  )}
                  <span>v{update.currentVersion}</span>
                </div>
              </div>
            )}
            {!primaryIp && <div>v{update.currentVersion}</div>}
          </>
        }
      />
    </div>
  );
}
