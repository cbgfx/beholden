/**
 * Rejoins PDF-extraction line wraps while retaining intentional paragraphs and list rows.
 * The compendium source represents accidental wraps as a newline followed by tabs.
 */
export function normalizeDescriptionText(text: string | string[] | null | undefined): string {
  const raw = Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
  return raw
    .replace(/\r\n?/gu, "\n")
    .replace(/\n[ \t]+(?=[\u2022\u25cf\u25aa\u2023\u25e6*-]\s)/gu, "\n")
    .replace(/\n\t+/gu, " ")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/ +\n/gu, "\n")
    .trim();
}
