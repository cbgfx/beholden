import React from "react";
import { useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { api, jsonInit } from "@/services/api";

const fieldStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)",
  color: "rgba(200,215,240,0.9)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: "var(--fs-medium)",
  width: "100%",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: "rgba(160,180,220,0.65)",
  marginBottom: 5,
  display: "block",
};

const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export function ProfileView() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = React.useState(user?.name ?? "");
  const [username, setUsername]       = React.useState(user?.username ?? "");
  const [currentPw, setCurrentPw]     = React.useState("");
  const [newPw, setNewPw]             = React.useState("");
  const [confirmPw, setConfirmPw]     = React.useState("");

  const [infoMsg, setInfoMsg]   = React.useState<string | null>(null);
  const [infoErr, setInfoErr]   = React.useState<string | null>(null);
  const [pwMsg, setPwMsg]       = React.useState<string | null>(null);
  const [pwErr, setPwErr]       = React.useState<string | null>(null);
  const [busy, setBusy]         = React.useState(false);

  async function handleInfoSave(e: React.FormEvent) {
    e.preventDefault();
    setInfoMsg(null); setInfoErr(null);
    const nameChanged     = displayName.trim() !== (user?.name ?? "");
    const usernameChanged = username.trim() !== (user?.username ?? "");
    if (!nameChanged && !usernameChanged) { setInfoMsg("No changes."); return; }

    const needsPw = usernameChanged;
    if (needsPw && !currentPw) { setInfoErr("Enter your current password to change username."); return; }

    setBusy(true);
    try {
      const body: Record<string, string> = {};
      if (nameChanged)     body.name = displayName.trim();
      if (usernameChanged) { body.username = username.trim(); body.currentPassword = currentPw; }

      const res = await api<{ ok: boolean; token: string; user: { id: string; username: string; name: string; isAdmin: boolean; hasDmAccess: boolean } }>(
        "/api/me/profile", jsonInit("PUT", body)
      );
      updateUser(res.user, res.token);
      setInfoMsg("Saved!");
      setCurrentPw("");
    } catch (err: unknown) {
      setInfoErr(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null); setPwErr(null);
    if (!newPw) { setPwErr("Enter a new password."); return; }
    if (newPw.length < 4) { setPwErr("Password must be at least 4 characters."); return; }
    if (newPw !== confirmPw) { setPwErr("Passwords do not match."); return; }

    setBusy(true);
    try {
      const res = await api<{ ok: boolean; token: string; user: { id: string; username: string; name: string; isAdmin: boolean; hasDmAccess: boolean } }>(
        "/api/me/profile", jsonInit("PUT", { newPassword: newPw })
      );
      updateUser(res.user, res.token);
      setPwMsg("Password updated!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      setPwErr(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: "var(--fs-subtitle)",
    cursor: busy ? "default" : "pointer", border: "none",
    background: C.accentHl, color: C.bg, opacity: busy ? 0.6 : 1,
    alignSelf: "flex-start",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "36px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Back */}
        <button type="button" onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "var(--fs-subtitle)", alignSelf: "flex-start", padding: 0 }}>
          ← Back
        </button>

        <h1 style={{ margin: 0, fontSize: "var(--fs-hero)", fontWeight: 800 }}>Account Settings</h1>

        {/* Display name + username */}
        <form onSubmit={handleInfoSave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: C.accentHl, marginBottom: 2 }}>Profile</div>

          <div>
            <label style={labelStyle}>Display Name</label>
            <input style={fieldStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
          </div>

          <div>
            <label style={labelStyle}>Username</label>
            <input style={fieldStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="username" autoComplete="username" />
          </div>

          {username.trim() !== (user?.username ?? "") && (
            <div>
              <label style={labelStyle}>Current Password <span style={{ color: "rgba(248,113,113,0.9)" }}>*</span></label>
              <input style={fieldStyle} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                placeholder="Required to change username" autoComplete="current-password" />
            </div>
          )}

          {infoErr && <div style={{ color: "rgba(248,113,113,0.9)", fontSize: "var(--fs-subtitle)" }}>{infoErr}</div>}
          {infoMsg && <div style={{ color: "rgba(74,222,128,0.9)", fontSize: "var(--fs-subtitle)" }}>{infoMsg}</div>}

          <button type="submit" style={btnBase} disabled={busy}>Save Profile</button>
        </form>

        {/* Password change */}
        <form onSubmit={handlePasswordSave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: C.accentHl, marginBottom: 2 }}>Change Password</div>

          <div>
            <label style={labelStyle}>New Password</label>
            <input style={fieldStyle} type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="At least 4 characters" autoComplete="new-password" />
          </div>

          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input style={fieldStyle} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password" autoComplete="new-password" />
          </div>

          {pwErr && <div style={{ color: "rgba(248,113,113,0.9)", fontSize: "var(--fs-subtitle)" }}>{pwErr}</div>}
          {pwMsg && <div style={{ color: "rgba(74,222,128,0.9)", fontSize: "var(--fs-subtitle)" }}>{pwMsg}</div>}

          <button type="submit" style={btnBase} disabled={busy}>Update Password</button>
        </form>

      </div>
    </div>
  );
}
