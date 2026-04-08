function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const PUBLIC_API_ORIGIN = (() => {
  const raw = String(process.env.BEHOLDEN_PUBLIC_API_ORIGIN ?? "").trim();
  if (!raw) return "";
  try {
    return trimTrailingSlash(new URL(raw).toString());
  } catch {
    return trimTrailingSlash(raw);
  }
})();

export function absolutizePublicUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!PUBLIC_API_ORIGIN || !pathOrUrl.startsWith("/")) return pathOrUrl;
  return `${PUBLIC_API_ORIGIN}${pathOrUrl}`;
}

