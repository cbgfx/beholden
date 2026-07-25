import { normalizeDescriptionText } from "../domain/text/normalizeDescriptionText";

/** Shared renderer for compendium prose. Callers retain control of their surrounding card styles. */
export function FormattedText(props: { text: string | string[] | null | undefined }) {
  return normalizeDescriptionText(props.text);
}
