import React from "react";
import { Link } from "react-router-dom";
import { theme, withAlpha } from "@/theme/theme";
import { useStore } from "@/store";

export function ShellLayout(props: { children: React.ReactNode }) {
  const { state } = useStore();
  const showSupport = state.meta?.support === true;

  const ips = state.meta?.ips ?? [];
  const lanIps = ips.filter((ip) => ip.startsWith("192.168."));
  const primaryIp = lanIps[0] ?? null;
  const otherIps = ips.filter((ip) => ip !== primaryIp);

  return (
    <div
      className="shellLayout"
      style={{
        fontFamily: "system-ui, Segoe UI, Arial",
        background: theme.colors.bg,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>{props.children}</div>

      <footer
        style={{
          borderTop: `1px solid ${theme.colors.panelBorder}`,
          padding: "10px 16px",
          color: theme.colors.muted,
          fontSize: "var(--fs-medium)",
          background: withAlpha(theme.colors.panelBg, 0.12),
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto minmax(0, 1fr)",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Column 1 — Left */}
        <div style={{ minWidth: 0, justifySelf: "start" }}>
          <div>© {new Date().getFullYear()} Beholden. All rights reserved.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span>Icons made by</span>
            <a target="_blank" rel="noreferrer" href="https://game-icons.net" style={{ color: theme.colors.muted }}>
              https://game-icons.net
            </a>
          </div>
        </div>

        {/* Column 2 — Center Left */}
        <div
          style={{
            justifySelf: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <Link to="/about" style={{ color: theme.colors.accentPrimary, textDecoration: "none" }}>
            About
          </Link>
          <Link to="/faq" style={{ color: theme.colors.accentPrimary, textDecoration: "none" }}>
            FAQ
          </Link>
          <Link to="/updates" style={{ color: theme.colors.accentPrimary, textDecoration: "none" }}>
            Future Updates
          </Link>
        </div>

        {/* Column 3 — Center Right */}
        <div style={{ justifySelf: "center", display: "flex", justifyContent: "center" }}>
          {showSupport && (
            <a
              href="https://www.buymeacoffee.com/beholden"
              target="_blank"
              rel="noreferrer"
              title="Buy me a pizza"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy me a pizza"
                style={{ height: 44, width: "auto" }}
              />
            </a>
          )}
        </div>

        {/* Column 4 — Right */}
        <div style={{ justifySelf: "end", textAlign: "right", fontSize: 12, opacity: 0.75 }}>
          {primaryIp && (
            <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
              <code>
                http://{primaryIp}:{state.meta?.port}
              </code>

              {otherIps.length > 0 && (
                <details>
                  <summary style={{ cursor: "pointer", userSelect: "none" }}>more</summary>
                  <div style={{ marginTop: 6, display: "grid", gap: 4, justifyItems: "end" }}>
                    {otherIps.map((ip) => (
                      <code key={ip}>
                        http://{ip}:{state.meta?.port}
                      </code>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
