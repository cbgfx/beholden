import type { TFunction } from "i18next";

// D&D currency (gp/sp/cp) and weight (lb) aren't real ISO units, so Intl.NumberFormat's
// currency/unit styles don't apply — this formats the number via Intl and pulls the
// (translatable) unit label from the "shared" namespace.
export function formatCurrency(t: TFunction, amounts: { gp?: number; sp?: number; cp?: number }, language: string): string {
  const nf = new Intl.NumberFormat(language);
  const parts: string[] = [];
  if (amounts.gp) parts.push(`${nf.format(amounts.gp)} ${t("units.gp", { ns: "shared" })}`);
  if (amounts.sp) parts.push(`${nf.format(amounts.sp)} ${t("units.sp", { ns: "shared" })}`);
  if (amounts.cp) parts.push(`${nf.format(amounts.cp)} ${t("units.cp", { ns: "shared" })}`);
  return parts.length > 0 ? parts.join(" ") : `0 ${t("units.gp", { ns: "shared" })}`;
}

export function formatWeight(t: TFunction, lb: number, language: string): string {
  return `${new Intl.NumberFormat(language).format(lb)} ${t("units.lb", { ns: "shared" })}`;
}
