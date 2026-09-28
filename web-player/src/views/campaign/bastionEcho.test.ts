/**
 * Echo suppression for broadcast-driven refreshes.
 *
 * Every socket receives a `bastions:delta`, including the socket belonging to whoever made the
 * change. Before this, the author reacted to its own save by re-fetching and re-rendering, which on
 * a 350ms autosave debounce meant the editor reloaded continuously while you typed.
 */
import { describe, expect, it } from "vitest";
import { getClientId, isOwnEcho } from "@beholden/shared/ui";

describe("getClientId", () => {
  it("is stable for the lifetime of the tab", () => {
    expect(getClientId()).toBe(getClientId());
  });

  it("is a non-empty string short enough for the server's field limit", () => {
    const id = getClientId();
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(64);
  });
});

describe("isOwnEcho", () => {
  it("recognises the broadcast caused by this tab's own write", () => {
    expect(isOwnEcho({ campaignId: "c1", action: "upsert", originClientId: getClientId() })).toBe(true);
  });

  it("does not claim another client's change", () => {
    // The whole point: someone else's edit must still trigger a refresh.
    expect(isOwnEcho({ campaignId: "c1", action: "upsert", originClientId: "some-other-tab" })).toBe(false);
  });

  it("treats an unattributed event as someone else's", () => {
    // Older clients don't send a clientId. Refreshing needlessly is safe; skipping a real change
    // is not, so the absence of an origin must never read as "ours".
    expect(isOwnEcho({ campaignId: "c1", action: "upsert" })).toBe(false);
    expect(isOwnEcho({ campaignId: "c1", action: "refresh", originClientId: null })).toBe(false);
    expect(isOwnEcho({ campaignId: "c1", action: "upsert", originClientId: 42 })).toBe(false);
  });

  it("tolerates a malformed payload", () => {
    expect(isOwnEcho(null)).toBe(false);
    expect(isOwnEcho(undefined)).toBe(false);
    expect(isOwnEcho("upsert")).toBe(false);
  });
});
