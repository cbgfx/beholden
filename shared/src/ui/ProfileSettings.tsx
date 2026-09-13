import React from "react";
import { useTranslation } from "react-i18next";
import { useTextScalePreview } from "./useTextScalePreview";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useProfileSave } from "./useProfileSave";
import { LanguageSwitcher } from "./LanguageSwitcher";

type ProfileTheme = {
  colors: { bg: string; text: string; muted: string; panelBg: string; panelBorder: string;
    accentHighlight: string; red: string; green: string };
  radius: { control: number; panel: number };
};

export function ProfileSettings({ theme, Button, SelectComponent, styles = {} }: {
  theme: ProfileTheme;
  Button: React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" }>;
  SelectComponent?: React.ComponentType<React.SelectHTMLAttributes<HTMLSelectElement>>;
  styles?: { field?: React.CSSProperties; label?: React.CSSProperties; section?: React.CSSProperties; button?: React.CSSProperties; fontFamily?: string };
}) {
  const { t } = useTranslation("shared");
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
    if (!nameChanged && !usernameChanged) { setInfoMsg(t("profileSettings.noChanges")); return; }
    if (usernameChanged && !currentPw) { setInfoErr(t("profileSettings.currentPasswordRequiredError")); return; }

    try {
      const body: Record<string, string> = {};
      if (nameChanged)     body.name = displayName.trim();
      if (usernameChanged) { body.username = username.trim(); body.currentPassword = currentPw; }

      if (!await save(body)) return;
      setInfoMsg(t("profileSettings.saved"));
      setCurrentPw("");
    } catch (err: unknown) {
      setInfoErr(String((err as Error)?.message ?? err));
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null); setPwErr(null);
    if (!currentPw) { setPwErr(t("profileSettings.enterCurrentPassword")); return; }
    if (!newPw) { setPwErr(t("profileSettings.enterNewPassword")); return; }
    if (newPw.length < 4) { setPwErr(t("profileSettings.passwordTooShort")); return; }
    if (newPw !== confirmPw) { setPwErr(t("profileSettings.passwordsDoNotMatch")); return; }

    try {
      if (!await save({ newPassword: newPw, currentPassword: currentPw })) return;
      setPwMsg(t("profileSettings.passwordUpdated"));
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      setPwErr(String((err as Error)?.message ?? err));
    }
  }

  async function handleDisplaySave(e: React.FormEvent) {
    e.preventDefault(); setDisplayMsg(null); setDisplayErr(null);
    try {
      if (await save({ textScale })) setDisplayMsg(t("profileSettings.saved"));
    } catch (err: unknown) {
      setDisplayErr(err instanceof Error ? err.message : t("profileSettings.unableToSaveDisplay"));
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
          {"← "}{t("profileSettings.back")}
        </button>

        <h1 style={{ margin: 0, fontSize: "var(--fs-hero)", fontWeight: 800 }}>{t("profileSettings.title")}</h1>

        <form onSubmit={handleInfoSave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: theme.colors.accentHighlight, marginBottom: 2 }}>{t("profileSettings.profileSection")}</div>

          <div>
            <label style={labelStyle}>{t("profileSettings.displayName")}</label>
            <input style={fieldStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t("profileSettings.displayNamePlaceholder")} />
          </div>

          <div>
            <label style={labelStyle}>{t("profileSettings.username")}</label>
            <input style={fieldStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder={t("profileSettings.usernamePlaceholder")} autoComplete="username" />
          </div>

          {username.trim() !== (user?.username ?? "") && (
            <div>
              <label style={labelStyle}>{t("profileSettings.currentPassword")} <span style={{ color: theme.colors.red }}>*</span></label>
              <input style={fieldStyle} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                placeholder={t("profileSettings.currentPasswordRequiredPlaceholder")} autoComplete="current-password" />
            </div>
          )}

          {infoErr && <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{infoErr}</div>}
          {infoMsg && <div style={{ color: theme.colors.green, fontSize: "var(--fs-subtitle)" }}>{infoMsg}</div>}

          <Button type="submit" variant="primary" style={btnStyle} disabled={busy}>{t("profileSettings.saveProfile")}</Button>
        </form>

        <form onSubmit={handleDisplaySave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: theme.colors.accentHighlight }}>{t("profileSettings.displaySection")}</div>
          <label style={labelStyle}>{t("profileSettings.textSize", { percent: Math.round(textScale * 100) })}</label>
          <input aria-label={t("profileSettings.textSizeAria")} type="range" min={0.85} max={1.3} step={0.05} value={textScale} onChange={(event) => previewTextScale(Number(event.target.value))} />
          <div style={{ position: "relative", height: "var(--fs-body)", color: theme.colors.muted, fontSize: "var(--fs-small)" }}><span style={{ position: "absolute", left: 0 }}>{t("profileSettings.smaller")}</span><span style={{ position: "absolute", left: "33.333%", transform: "translateX(-50%)" }}>{t("profileSettings.default")}</span><span style={{ position: "absolute", right: 0 }}>{t("profileSettings.larger")}</span></div>
          <LanguageSwitcher labelStyle={labelStyle} fieldStyle={fieldStyle} SelectComponent={SelectComponent} />
          {displayMsg ? <div style={{ color: theme.colors.green, fontSize: "var(--fs-subtitle)" }}>{displayMsg}</div> : null}
          {displayErr ? <div role="alert" style={{ color: theme.colors.red }}>{displayErr}</div> : null}
          <Button type="submit" variant="primary" style={btnStyle} disabled={busy}>{t("profileSettings.saveDisplay")}</Button>
        </form>

        <form onSubmit={handlePasswordSave} style={sectionStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: theme.colors.accentHighlight, marginBottom: 2 }}>{t("profileSettings.changePasswordSection")}</div>

          <div>
            <label style={labelStyle}>{t("profileSettings.currentPassword")}</label>
            <input style={fieldStyle} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label style={labelStyle}>{t("profileSettings.newPassword")}</label>
            <input style={fieldStyle} type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder={t("profileSettings.newPasswordPlaceholder")} autoComplete="new-password" />
          </div>

          <div>
            <label style={labelStyle}>{t("profileSettings.confirmNewPassword")}</label>
            <input style={fieldStyle} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              placeholder={t("profileSettings.confirmNewPasswordPlaceholder")} autoComplete="new-password" />
          </div>

          {pwErr && <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{pwErr}</div>}
          {pwMsg && <div style={{ color: theme.colors.green, fontSize: "var(--fs-subtitle)" }}>{pwMsg}</div>}

          <Button type="submit" variant="primary" style={btnStyle} disabled={busy}>{t("profileSettings.updatePassword")}</Button>
        </form>

      </div>
    </div>
  );
}
