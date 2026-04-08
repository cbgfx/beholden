import React, { useState } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";

export interface UserFormData {
  username: string;
  name: string;
  password: string;
  isAdmin: boolean;
}

interface Props {
  title: string;
  initial: Partial<UserFormData>;
  passwordRequired: boolean;
  onSave: (data: UserFormData) => Promise<void>;
  onClose: () => void;
}

export function UserModal({ title, initial, passwordRequired, onSave, onClose }: Props) {
  const [form, setForm] = useState<UserFormData>({
    username: initial.username ?? "",
    name: initial.name ?? "",
    password: "",
    isAdmin: initial.isAdmin ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof UserFormData>(k: K, v: UserFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 5,
    fontSize: "var(--fs-small)",
    fontWeight: 600,
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 14 };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: theme.colors.scrim,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.colors.modalBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
          padding: "28px 28px 24px",
          width: "100%", maxWidth: 400,
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: "var(--fs-title)", fontWeight: 700 }}>{title}</h2>

        <form onSubmit={handleSave}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Display Name</label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus disabled={saving} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Username</label>
            <Input value={form.username} onChange={(e) => set("username", e.target.value)} disabled={saving} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Password {!passwordRequired && <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span>}
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={passwordRequired ? "" : "••••••••"}
              disabled={saving}
            />
          </div>
          <div style={{ ...fieldStyle, display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              id="isAdmin"
              checked={form.isAdmin}
              onChange={(e) => set("isAdmin", e.target.checked)}
              disabled={saving}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label htmlFor="isAdmin" style={{ fontSize: "var(--fs-medium)", cursor: "pointer" }}>
              Admin (can access this panel and manage users)
            </label>
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: "8px 12px",
              borderRadius: theme.radius.control,
              background: `${theme.colors.red}22`,
              border: `1px solid ${theme.colors.red}55`,
              color: theme.colors.red, fontSize: "var(--fs-subtitle)",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !form.name.trim() || !form.username.trim() || (passwordRequired && !form.password)}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
