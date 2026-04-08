// src/lib/format/titleCase.ts
export function titleCase(str: string): string {
  if (!str) return "";
  return str.replace(/\w\S*/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}
