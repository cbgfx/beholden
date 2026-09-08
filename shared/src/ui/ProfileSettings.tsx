import React from "react";
import { useTextScalePreview } from "./useTextScalePreview";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useProfileSave } from "./useProfileSave";

type ProfileTheme = {
  colors: { bg: string; text: string; muted: string; panelBg: string; panelBorder: string;
    accentHighlight: string; red: string; green: string };
  radius: { control: number; panel: number };
};

export function ProfileSettings({ theme, Button, styles = {} }: {
  theme: ProfileTheme;
  Button: React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" }>;
  styles?: { field?: React.CSSProperties; label?: React.CSSProperties; section?: React.CSSProperties; button?: React.CSSProperties; fontFamily?: string };
}) {
  const fieldStyle: React.CSSProperties = {
    background: theme.colors.panelBg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.control,
    padding: "8px 12px",
    fontSize: "var(--fs-medium)",
    width: "100%",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  
  const labelStyle: React.CSSProperties = {
    fontSize: "var(--fs-small)",
    fontWeight: 600,
    color: theme.colors.muted,
    marginBottom: 5,
    display: "block",
  };
  
  const sectionStyle: React.CSSProperties = {
    background: theme.colors.panelBg,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.panel,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };
  
  
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  Object.assign(fieldStyle, styles.field);
  Object.assign(labelStyle, styles.label);
  Object.assign(sectionStyle, styles.section);

  const [displayName, setDisplayName] = React.useState(user?.name ?? "");
  const [username, setUsername]       = React.useState(user?.username ?? "");
  const [currentPw, setCurrentPw]     = React.useState("");
  const [newPw, setNewPw]             = React.useState("");
  const [confirmPw, setConfirmPw]     = React.useState("");
  const { textScale, previewTextScale } = useTextScalePreview(user?.textScale);
  const [displayMsg, setDisplayMsg] = React.useState<string | null>(null);
  const [displayErr, setDisplayErr] = React.useState<string | null>(null);

  const [infoMsg, setInfoMsg] = React.useState<string | null>(null);
  const [infoErr, setInfoErr] = React.useState<string | null>(null);
  const [pwMsg, setPwMsg]     = React.useState<string | null>(null);
  const [pwErr, setPwErr]     = React.useState<string | null>(null);
  const { busy, save } = useProfileSave(updateUser);

  async function handleInfoSave(e: React.FormEvent) {
    e.preventDefault();
    setInfoMsg(null); setInfoErr(null);
    const nameChanged     = displayName.trim() !== (user?.name ?? "");
    const usernameChanged = username.trim() !== (user?.username ?? "");
    if (!nameChanged && !usernameChanged) { setInfoMsg("No changes."); return; }
    if (usernameChanged && !currentPw) { setInfoErr("Enter your current password to change username."); return; }

    try {
      const body: Record<string, string> = {};
      if (nameChanged)     body.name = displayName.trim();
      if (usernameChanged) { body.username = username.trim(); body.currentPassword = currentPw; }

      if (!await save(body)) return;
      setInfoMsg("Saved!");
      setCurrentPw("");
    } catch (err: unknown) {
      setInfoErr(String((err as Error)?.message ?? err));
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null); setPwErr(null);
    if (!newPw) { setPwErr("Enter a new password."); return; }
    if (newPw.length < 4) { setPwErr("Password must be at least 4 characters."); return; }
    if (newPw !== confirmPw) { setPwErr("Passwords do not match."); return; }

    try {
      if (!await save({ newPassword: newPw })) return;
      setPwMsg("Password updated!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      setPwErr(String((err as Error)?.message ?? err));
    }
  }

  async function handleDisplaySave(e: React.FormEvent) {
    e.preventDefault(); setDisplayMsg(null); setDisplayErr(null);
    try {
      if (await save({ textScale })) setDisplayMsg("Saved!");
    } catch (err: unknown) {
      setDisplayErr(err instanceof Error ? err.message : "Unable to save display settings.");
    }
  }

  const btnStyle: React.CSSProperties = {
    padding: "8px 20px",
    fontSize: "var(--fs-subtitle)",
    alignSelf: "flex-start",
    ...styles.button,
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: theme.colors.bg, color: theme.colors.text, fontFamily: styles.fontFamily ?? "inherit" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "36px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

        <button type="button" onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: theme.colors.muted, cursor: "pointer", fontSize: "var(--fs-subtitle)", alignSelf: "flex-start", padding: 0 }}>
          ← Back
        </button>

        <h1 style={{ margin: 0, fontSize: "var(--fs-hero)", fontWeight: 800 }}>Account Settings</h1>

        <form onSubmit={handleInfoSave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: theme.colors.accentHighlight, marginBottom: 2 }}>Profile</div>

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
              <label style={labelStyle}>Current Password <span style={{ color: theme.colors.red }}>*</span></label>
              <input style={fieldStyle} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                placeholder="Required to change username" autoComplete="current-password" />
            </div>
          )}

          {infoErr && <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{infoErr}</div>}
          {infoMsg && <div style={{ color: theme.colors.green, fontSize: "var(--fs-subtitle)" }}>{infoMsg}</div>}

          <Button type="submit" variant="primary" style={btnStyle} disabled={busy}>Save Profile</Button>
        </form>

        <form onSubmit={handleDisplaySave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: theme.colors.accentHighlight }}>Display</div>
          <label style={labelStyle}>Text size — {Math.round(textScale * 100)}%</label>
          <input aria-label="Text size" type="range" min={0.85} max={1.3} step={0.05} value={textScale} onChange={(event) => previewTextScale(Number(event.target.value))} />
          <div style={{ position: "relative", height: "var(--fs-body)", color: theme.colors.muted, fontSize: "var(--fs-small)" }}><span style={{ position: "absolute", left: 0 }}>Smaller</span><span style={{ position: "absolute", left: "33.333%", transform: "translateX(-50%)" }}>Default</span><span style={{ position: "absolute", right: 0 }}>Larger</span></div>
          {displayMsg ? <div style={{ color: theme.colors.green, fontSize: "var(--fs-subtitle)" }}>{displayMsg}</div> : null}
          {displayErr ? <div role="alert" style={{ color: theme.colors.red }}>{displayErr}</div> : null}
          <Button type="submit" variant="primary" style={btnStyle} disabled={busy}>Save Display</Button>
        </form>

        <form onSubmit={handlePasswordSave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: theme.colors.accentHighlight, marginBottom: 2 }}>Change Password</div>

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

          {pwErr && <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{pwErr}</div>}
          {pwMsg && <div style={{ color: theme.colors.green, fontSize: "var(--fs-subtitle)" }}>{pwMsg}</div>}

          <Button type="submit" variant="primary" style={btnStyle} disabled={busy}>Update Password</Button>
        </form>

      </div>
    </div>
  );
}
