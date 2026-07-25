import type { Request } from "express";
import { absolutizePublicUrlForRequest } from "./publicUrl.js";

export function withAbsoluteImageUrl<T extends { imageUrl?: string | null }>(req: Request, value: T): T {
  return {
    ...value,
    ...(value.imageUrl !== undefined
      ? { imageUrl: absolutizePublicUrlForRequest(req, value.imageUrl) }
      : {}),
  };
}
