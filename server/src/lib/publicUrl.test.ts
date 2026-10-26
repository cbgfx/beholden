import assert from "node:assert/strict";
import { test } from "node:test";
import { absolutizePublicUrl, absolutizePublicUrlForRequest } from "./publicUrl.js";
test("installation image URLs follow the current service after consolidation", () => {
  const req = { protocol: "https", get: (name: string) => name === "host" ? "current.example" : undefined } as Parameters<typeof absolutizePublicUrlForRequest>[0];
  for (const mount of ["campaign", "player", "character", "binder-mortal", "binder-deity"]) {
    const relative = `/${mount}-images/id.webp?v=123`;
    assert.equal(absolutizePublicUrl(`https://retired.example${relative}`), relative);
    assert.equal(absolutizePublicUrlForRequest(req, `https://retired.example${relative}`), `https://current.example${relative}`);
  }
  assert.equal(absolutizePublicUrlForRequest(req, "https://images.example/portrait.webp"), "https://images.example/portrait.webp");
});
