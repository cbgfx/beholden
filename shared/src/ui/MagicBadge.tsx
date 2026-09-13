import { useTranslation } from "react-i18next";

export function MagicBadge({
  color,
  borderColor = "#6d28d966",
  label,
}: {
  color: string;
  borderColor?: string;
  label?: string;
}) {
  const { t } = useTranslation("shared");
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: "var(--fs-small)",
        fontWeight: 700,
        color,
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        padding: "1px 6px",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {label ?? t("magicBadge.label")}
    </span>
  );
}
