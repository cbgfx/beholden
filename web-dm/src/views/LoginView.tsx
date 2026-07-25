// web-dm/src/views/LoginView.tsx

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";

export function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.colors.bg,
        backgroundImage: "url('/beholden_logo.png')",
        backgroundSize: "40%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.colors.text,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)" }} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: theme.colors.panelBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 380,
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 6px",
            fontSize: "var(--fs-hero)",
            fontWeight: 800,
            color: theme.colors.accentPrimary,
            letterSpacing: "-0.5px",
          }}
        >
          Beholden - DM
        </h1>
        <p style={{ margin: "0 0 28px", color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: "var(--fs-subtitle)", fontWeight: 600 }}>
              Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: "var(--fs-subtitle)", fontWeight: 600 }}>
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: theme.radius.control,
                background: `${theme.colors.red}22`,
                border: `1px solid ${theme.colors.red}55`,
                color: theme.colors.red,
                fontSize: "var(--fs-subtitle)",
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !username || !password}
            style={{ width: "100%" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
