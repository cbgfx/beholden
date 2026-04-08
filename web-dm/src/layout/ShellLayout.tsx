import React from "react";
import { Link } from "react-router-dom";
import { theme, withAlpha } from "@/theme/theme";
import { useStore } from "@/store";
import { TopBar } from "@/layout/TopBar";
import { api } from "@/services/api";
import { FooterGrid } from "@beholden/shared/ui";

function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  React.useEffect(() => {
    api<{ ok: boolean; updateAvailable?: boolean }>("/api/update-check")
      .then((r) => { if (r.ok && r.updateAvailable) setUpdateAvailable(true); })
      .catch(() => {});
  }, []);
  return updateAvailable;
}

export function ShellLayout(props: { children: React.ReactNode }) {
  const { state } = useStore();

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

  const updateAvailable = useUpdateCheck();
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
      {/* Header with surface chrome */}
      <header
        style={{
          background: theme.colors.panelBg,
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
          padding: "8px 16px",
          flexShrink: 0,
        }}
      >
        <TopBar />
      </header>

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
          <a href="https://www.buymeacoffee.com/beholden" target="_blank" rel="noreferrer" title="Buy me a pizza" style={{ display: "inline-flex", alignItems: "center" }}>
            <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a pizza" style={{ height: 44, width: "auto" }} />
          </a>
        ) : null}
        right={
          <>
            {updateAvailable && (
              <a
                href="https://github.com/cbgfx/beholden"
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.colors.accentPrimary, textDecoration: "none", fontWeight: 600, fontSize: "var(--fs-medium)" }}
              >
                Update available →
              </a>
            )}
            {primaryIp && (
              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                <code>http://{primaryIp}:{state.meta?.port}</code>
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
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
