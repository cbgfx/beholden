import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

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
    <div style={styles.page}>
      <div style={styles.overlay} />
      <div style={styles.card}>
        <h1 style={styles.title}>Beholden</h1>
        <p style={styles.subtitle}>Sign in to continue</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
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
            <label style={styles.label}>Password</label>
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

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              ...styles.button,
              opacity: loading || !username || !password ? 0.5 : 1,
              cursor: loading || !username || !password ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
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
  button: {
    width: "100%",
    padding: "10px 0",
    background: "var(--accent)",
    color: "var(--bg)",
    border: "none",
    borderRadius: "var(--radius-ctrl)",
    fontSize: "var(--fs-body)",
    fontWeight: 700,
    fontFamily: "inherit",
  },
};
