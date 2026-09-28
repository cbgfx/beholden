// server/src/server/eventVisibility.ts
//
// Who may receive which broadcast.
//
// Scope filtering in ws.ts answers "is this socket looking at that campaign?", which is about
// relevance, not permission. Some events carry material that only the DM may see, and for those the
// recipient's role has to be checked too - otherwise locking down the HTTP routes achieves nothing,
// because the same content arrives unasked over the socket.

import type { Db } from "../lib/db.js";
import { canSeeCampaignContent, canSeeDmContent } from "../middleware/campaignAuth.js";
import type { ServerEventMap, ServerEventType } from "./events.js";
import type { WsUser } from "./ws.js";

/**
 * Events that only a DM of the campaign may receive.
 *
 * The rule is the one the audit doc states: a broadcast must not carry anything the recipient
 * could not have fetched over HTTP, and must not tell them about something they are not allowed
 * to read. Every event type was checked against its routes' guards:
 *
 * - `notes:delta` - DM-only. Carries the note's title and text, which is the plot. Every note
 *   route is `dmOrAdmin`.
 * - `inpcs:delta` - DM-only. Carries ids rather than content, but all six INPC routes are
 *   `dmOrAdmin`, so a player cannot fetch what changed; the event only tells them it exists, and
 *   a client that reacted to it would get a 403. Neither player app listens for it.
 * - `treasure:delta` (carries a full entry) and `encounter:combatantsDelta` (carries a combatant)
 *   stay open: their `GET` routes are `memberOrAdmin`, so a player can already read exactly this.
 *   Whether they *should* be able to is a question for those systems, not for delivery.
 * - `players:delta`, `partyInventory:delta`, `partyCurrency:delta`, `bastions:delta`,
 *   `initiative:*`, `concentration:check`, `xp:awarded` - the party's own state, addressed to them.
 * - `adventures:delta`, `encounters:delta`, `campaigns:changed`, `compendium:changed`,
 *   `database:imported`, `hello`, `save:*` - ids or bare signals, nothing to leak.
 *
 * Anything added here fails closed: a socket with no identity receives none of it.
 */
const DM_ONLY_EVENTS: ReadonlySet<ServerEventType> = new Set<ServerEventType>([
  "notes:delta",
  "inpcs:delta",
]);

function campaignIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { campaignId?: unknown }).campaignId;
  return typeof value === "string" && value ? value : null;
}

const CAMPAIGN_EVENTS: ReadonlySet<ServerEventType> = new Set([
  "adventures:delta", "encounters:delta", "notes:delta",
  "players:delta", "inpcs:delta", "treasure:delta", "partyInventory:delta",
  "partyCurrency:delta", "bastions:delta", "encounter:combatantsDelta",
  "encounter:combatStateChanged", "initiative:prompt", "initiative:fulfilled",
  "concentration:check", "xp:awarded",
]);

function eventCampaignId(db: Db, type: ServerEventType, payload: unknown): string | null {
  const direct = campaignIdOf(payload);
  if (direct) return direct;
  if (type !== "encounter:combatantsDelta" && type !== "encounter:combatStateChanged") return null;
  const encounterId = payload && typeof payload === "object"
    ? (payload as { encounterId?: unknown }).encounterId
    : null;
  if (typeof encounterId !== "string" || !encounterId) return null;
  const row = db.prepare("SELECT campaign_id FROM encounters WHERE id = ?").get(encounterId) as { campaign_id?: string } | undefined;
  return row?.campaign_id ?? null;
}

/** Whether one socket's user may receive one event. Fails closed: no identity, no DM-only events. */
export function canDeliverEvent(
  db: Db,
  user: WsUser | null,
  type: ServerEventType,
  payload: ServerEventMap[ServerEventType],
): boolean {
  const campaignId = eventCampaignId(db, type, payload);
  if (DM_ONLY_EVENTS.has(type)) return canSeeDmContent(db, user, campaignId);
  if (CAMPAIGN_EVENTS.has(type)) return canSeeCampaignContent(db, user, campaignId);
  return Boolean(user);
}
