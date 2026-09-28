import { LanguageSwitcher } from "@beholden/shared/ui/LanguageSwitcher";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Select";
import { useUiTranslation } from "@beholden/shared/i18n";

export function LoginView() {
  const t = useUiTranslation("playerUi");
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
      setError(err instanceof Error ? err.message : t("Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.overlay} />
      <div style={styles.language}>
        <LanguageSwitcher SelectComponent={Select} showLabel={false} />
      </div>
      <div style={styles.card}>
        <h1 style={styles.title}>Beholden</h1>
        <p style={styles.subtitle}>{t("Sign in to continue")}</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>{t("Username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading}
              style={styles.input}
            />
          </div>

          <div style={{ ...styles.field, marginBottom: 24 }}>
            <label style={styles.label}>{t("Password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !username || !password}
            style={{ width: "100%", padding: "10px 0", fontSize: "var(--fs-body)" }}
          >
            {loading ? t("Signing in…") : t("Sign in")}
          </Button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    backgroundImage: "url('/beholden_logo.png')",
    backgroundSize: "40%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, Segoe UI, Arial, sans-serif",
    color: "var(--text)",
    position: "relative",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
  },
  language: {
    position: "absolute",
    top: 18,
    right: 18,
    zIndex: 2,
    width: 132,
  },
  card: {
    position: "relative",
    zIndex: 1,
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--radius-panel)",
    padding: "40px 36px",
    width: "100%",
    maxWidth: 380,
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 6px",
    fontSize: "var(--fs-hero)",
    fontWeight: 800,
    color: "var(--accent)",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    margin: "0 0 28px",
    color: "var(--muted)",
    fontSize: "var(--fs-medium)",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: "var(--fs-subtitle)",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    background: "var(--bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--radius-ctrl)",
    color: "var(--text)",
    fontSize: "var(--fs-medium)",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  },
  error: {
    marginBottom: 16,
    padding: "10px 12px",
    borderRadius: "var(--radius-ctrl)",
    background: "rgba(224,80,80,0.13)",
    border: "1px solid rgba(224,80,80,0.33)",
    color: "var(--red)",
    fontSize: "var(--fs-subtitle)",
  },
};
