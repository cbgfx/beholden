import type { Request } from "express";

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

function requestOrigin(req: Pick<Request, "protocol" | "get">): string {
  const forwardedProto = (String(req.get("x-forwarded-proto") ?? "")
    .split(",")[0] ?? "")
    .trim();
  const forwardedHost = (String(req.get("x-forwarded-host") ?? "")
    .split(",")[0] ?? "")
    .trim();
  const host = forwardedHost || String(req.get("host") ?? "").trim();
  const proto = forwardedProto || req.protocol || "http";
  if (!host) return "";
  return `${proto}://${host}`;
}

export function absolutizePublicUrlForRequest(
  req: Pick<Request, "protocol" | "get">,
  pathOrUrl: string | null | undefined,
): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!pathOrUrl.startsWith("/")) return pathOrUrl;
  if (PUBLIC_API_ORIGIN) return `${PUBLIC_API_ORIGIN}${pathOrUrl}`;
  const origin = requestOrigin(req);
  return origin ? `${origin}${pathOrUrl}` : pathOrUrl;
}
