import { useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { theme } from "@/theme/theme";
import { fetchBinderMembers, removeBinderMember, saveBinderMember, type BinderMember } from "@/services/binderApi";

export function BinderMembersPanel({ binderId }: { binderId: string }) {
  const [members, setMembers] = useState<BinderMember[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"collaborator" | "viewer">("collaborator");
  const [error, setError] = useState("");
  const reload = useCallback(async () => setMembers(await fetchBinderMembers(binderId)), [binderId]);
  useEffect(() => { void reload(); }, [reload]);
  return <section style={{ padding: 16, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg }}>
    <h2 style={{ margin: "0 0 12px" }}>Access</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
      <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} style={{ padding: "0 10px", borderRadius: 8 }}>
        <option value="collaborator">Collaborator</option><option value="viewer">Viewer</option>
      </select>
      <Button onClick={async () => { try { setError(""); await saveBinderMember(binderId, username, role); setUsername(""); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update access"); } }} disabled={!username.trim()}>Add</Button>
    </div>
    {error ? <div style={{ color: theme.colors.red, marginBottom: 8 }}>{error}</div> : null}
    <div style={{ display: "grid", gap: 6 }}>{members.map((member) => <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1 }}>{member.name} <span style={{ color: theme.colors.muted }}>@{member.username}</span></span>
      <span style={{ color: theme.colors.muted }}>{member.role}</span>
      {member.role !== "owner" ? <Button onClick={async () => { await removeBinderMember(binderId, member.id); await reload(); }}>Remove</Button> : null}
    </div>)}</div>
  </section>;
}
