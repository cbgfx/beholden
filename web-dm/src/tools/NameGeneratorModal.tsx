import React, { useState, useEffect } from "react";
import { Modal } from "@/components/overlay/Modal";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { ghostButtonStyle } from "@beholden/shared/ui";
import namesData from "@/lib/names.json";

type Gender = "male" | "female" | "fantasy";
type NamesData = { femname: string[]; malename: string[]; fantname: string[]; lastname: string[] };

const names = namesData as NamesData;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const GENDERS: { id: Gender; label: string }[] = [
  { id: "male",    label: "Male" },
  { id: "female",  label: "Female" },
  { id: "fantasy", label: "Fantasy" },
];

export function NameGeneratorModal(props: { isOpen: boolean; onClose: () => void }) {
  const [gender, setGender] = useState<Gender>("male");
  const [fullName, setFullName] = useState("");
  const [copied, setCopied] = useState(false);

  function generate(g: Gender) {
    const pool = g === "male" ? names.malename : g === "female" ? names.femname : names.fantname;
    const first = pickRandom(pool);
    const last  = g === "fantasy" ? pickRandom(names.fantname) : pickRandom(names.lastname);
    setFullName(`${first} ${last}`);
    setCopied(false);
  }

  useEffect(() => {
    if (props.isOpen) generate(gender);
  }, [props.isOpen, gender]);

  function handleGender(g: Gender) {
    setGender(g);
  }

  function handleCopy() {
    if (!fullName) return;
    navigator.clipboard.writeText(fullName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const btnBase: React.CSSProperties = {
    border: "none",
    borderRadius: theme.radius.control,
    padding: "8px 18px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    transition: "background 150ms, color 150ms",
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Name Generator" width={420} height={280}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: 28 }}>
        {/* Gender toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          {GENDERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleGender(id)}
              style={{
                ...btnBase,
                background: gender === id ? theme.colors.accentPrimary : withAlpha(theme.colors.text, 0.08),
                color: gender === id ? theme.colors.bg : theme.colors.text,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Name + Copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: theme.colors.text, letterSpacing: 0.5 }}>
            {fullName || "—"}
          </span>
          {fullName && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy name"
              style={{
                ...ghostButtonStyle({
                  textColor: copied ? theme.colors.green : theme.colors.muted,
                  borderColor: copied ? withAlpha(theme.colors.green, 0.4) : "transparent",
                  background: copied ? withAlpha(theme.colors.green, 0.15) : withAlpha(theme.colors.text, 0.08),
                  padding: "5px 12px",
                  fontSize: "var(--fs-tiny)",
                  borderRadius: theme.radius.control,
                }),
                fontWeight: 700,
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>

        {/* Regenerate */}
        <Button type="button" variant="primary" onClick={() => generate(gender)} style={{ padding: "10px 32px" }}>
          Regenerate
        </Button>
      </div>
    </Modal>
  );
}
