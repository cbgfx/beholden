import React, { useEffect, useState } from "react";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import type { User, Member } from "./adminTypes";

interface Props {
  campaignId: string;
  campaignName: string;
  existingUserIds: Set<string>;
  onAdd: (userId: string, role: "dm" | "player") => Promise<void>;
  onClose: () => void;
}

export function AddMemberModal({ campaignId: _campaignId, campaignName, existingUserIds, onAdd, onClose }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"dm" | "player">("player");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<User[]>("/api/admin/users").then((data) => {
      setUsers(data.filter((u) => !existingUserIds.has(u.id)));
    });
  }, [existingUserIds]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      await onAdd(userId, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
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

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: theme.colors.scrim,
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
          width: "100%", maxWidth: 380,
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--fs-title)", fontWeight: 700 }}>Add Member</h2>
        <p style={{ margin: "0 0 20px", fontSize: "var(--fs-subtitle)", color: theme.colors.muted }}>{campaignName}</p>

        <form onSubmit={handleAdd}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={saving}
              style={{
                width: "100%", padding: "10px 12px",
                borderRadius: theme.radius.control,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.inputBg,
                color: theme.colors.text,
                outline: "none",
              }}
            >
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Role</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["dm", "player"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: "10px 0",
                    borderRadius: theme.radius.control,
                    border: `1px solid ${role === r ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
                    background: role === r ? `${theme.colors.accentPrimary}22` : "transparent",
                    color: role === r ? theme.colors.accentPrimary : theme.colors.muted,
                    cursor: "pointer", fontWeight: 700, fontSize: "var(--fs-subtitle)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}
                >
                  {r === "dm" ? "Dungeon Master" : "Player"}
                </button>
              ))}
            </div>
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
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !userId}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
