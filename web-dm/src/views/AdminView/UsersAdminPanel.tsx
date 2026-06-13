// web-dm/src/views/AdminView/UsersAdminPanel.tsx
// Admin panel for managing users: list, create, edit, delete.

import React, { useEffect, useState, useCallback } from "react";
import { api, jsonInit } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import type { User } from "./adminTypes";
import { UserModal, type UserFormData } from "./UserModal";

export function UsersAdminPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | { type: "edit"; user: User } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<User[]>("/api/admin/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleCreate(form: UserFormData) {
    await api("/api/admin/users", jsonInit("POST", {
      username: form.username,
      name: form.name,
      password: form.password,
      isAdmin: form.isAdmin,
    }));
    setModal(null);
    refresh();
  }

  async function handleEdit(userId: string, form: UserFormData) {
    const body: Record<string, unknown> = { username: form.username, name: form.name, isAdmin: form.isAdmin };
    if (form.password) body.password = form.password;
    await api(`/api/admin/users/${userId}`, jsonInit("PUT", body));
    setModal(null);
    refresh();
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete user "${u.name}" (@${u.username})? This cannot be undone.`)) return;
    await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
    refresh();
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left",
    fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted,
    textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 14px", fontSize: "var(--fs-medium)",
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
    verticalAlign: "middle",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 700 }}>Users</h2>
        <Button variant="primary" onClick={() => setModal("create")}>+ New User</Button>
      </div>

      {loading ? (
        <div style={{ color: theme.colors.muted, padding: 20 }}>Loading…</div>
      ) : (
        <div style={{
          background: theme.colors.panelBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: theme.colors.muted, textAlign: "center" }}>
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                    {u.id === currentUser?.id && (
                      <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: theme.colors.accentHighlight, fontWeight: 600 }}>
                        (you)
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: theme.colors.muted }}>@{u.username}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: "var(--fs-small)", fontWeight: 700,
                      background: u.isAdmin ? `${theme.colors.accentPrimary}22` : `${theme.colors.panelBorder}`,
                      color: u.isAdmin ? theme.colors.accentPrimary : theme.colors.muted,
                      border: `1px solid ${u.isAdmin ? theme.colors.accentPrimary + "55" : theme.colors.panelBorder}`,
                    }}>
                      {u.isAdmin ? "Admin" : "Player"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Button variant="ghost" style={{ fontSize: "var(--fs-subtitle)", padding: "5px 10px" }}
                        onClick={() => setModal({ type: "edit", user: u })}>
                        Edit
                      </Button>
                      <Button variant="danger" style={{ fontSize: "var(--fs-subtitle)", padding: "5px 10px" }}
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser?.id}
                        title={u.id === currentUser?.id ? "Cannot delete your own account" : undefined}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "create" && (
        <UserModal
          title="Create User"
          initial={{}}
          passwordRequired
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}

      {modal !== null && modal !== "create" && modal.type === "edit" && (
        <UserModal
          title={`Edit User — ${modal.user.name}`}
          initial={{ username: modal.user.username, name: modal.user.name, isAdmin: modal.user.isAdmin }}
          passwordRequired={false}
          onSave={(form) => handleEdit(modal.user.id, form)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
