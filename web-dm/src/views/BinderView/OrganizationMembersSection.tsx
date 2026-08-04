// web-dm/src/views/BinderView/OrganizationMembersSection.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { fetchBinderOrganizationMembers, type BinderOrganizationMember } from "@/services/binderReferenceApi";

export function OrganizationMembersSection(props: { binderId: string; organizationId: string; count: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<BinderOrganizationMember[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setOpen(false); setMembers(null); }, [props.organizationId]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || members !== null || loading) return;
    setLoading(true);
    try { setMembers(await fetchBinderOrganizationMembers(props.binderId, props.organizationId)); }
    finally { setLoading(false); }
  }

  return <section>
    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>Members</div>
    {props.count ? <button type="button" onClick={() => void toggle()} aria-expanded={open} style={{ marginTop: 7, padding: 0, border: 0, background: "transparent", color: theme.colors.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-body)", textDecoration: "underline", textUnderlineOffset: 3 }}>{props.count} {open ? "▴" : "▾"}</button> : <div style={{ fontSize: "var(--fs-body)", marginTop: 7 }}>None</div>}
    {open ? <div style={{ display: "grid", gap: 2, marginTop: 8, padding: 8, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, background: theme.colors.inputBg }}>
      {loading ? <div style={{ color: theme.colors.muted, padding: 6 }}>Loading…</div> : (members ?? []).map((member) => <button key={member.id} type="button" onClick={() => navigate(`/binder/${props.binderId}/mortals/${member.id}`)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 8px", border: 0, borderRadius: 6, background: "transparent", color: theme.colors.text, cursor: "pointer", font: "inherit", textAlign: "left" }}><span>{member.name}</span>{member.position || member.role ? <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{member.position ?? member.role}</span> : null}</button>)}
    </div> : null}
  </section>;
}
