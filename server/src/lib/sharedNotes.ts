// server/src/lib/sharedNotes.ts
//
// Shared notes are stored as one JSON string per row (`shared_notes` on campaigns, players and
// user_characters) rather than as rows of their own.
//
// Routes used to hand that column whatever arrived:
//
//   const sharedNotes = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
//
// which quietly turned a missing field, a null, or a client bug into "delete every shared note on
// this row". Writes are operations now (below), so a request says which note changed and the list
// itself is only ever built here.

// --- operations -------------------------------------------------------------
//
// Writing the whole list back on every change is last-write-wins: a DM editing one note and a
// player adding another at the same moment means one of them silently loses their edit, because
// each client sends the list as it looked when they started typing.
//
// These operations say what changed instead of what the list should now be, so the server applies
// them to whatever is currently stored. Same shape as the bastion writes.

export type SharedNote = { id: string; title: string; text: string };

export type SharedNoteOperation =
  | { type: "upsert"; id: string; title: string; text: string }
  | { type: "delete"; id: string }
  | { type: "reorder"; ids: string[] };

/** A stored entry we can still address: anything without an id is not a note anyone can edit. */
function isNoteLike(entry: unknown): boolean {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const note = entry as { id?: unknown; title?: unknown; text?: unknown };
  if (typeof note.id !== "string" || note.id.trim() === "") return false;
  if (note.title !== undefined && typeof note.title !== "string") return false;
  if (note.text !== undefined && typeof note.text !== "string") return false;
  return true;
}

/** Reads a stored blob into a list. Anything unreadable is an empty list, as every client does. */
export function parseSharedNotes(raw: unknown): SharedNote[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNoteLike).map((entry) => {
      const note = entry as Partial<SharedNote>;
      return { id: String(note.id), title: String(note.title ?? ""), text: String(note.text ?? "") };
    });
  } catch {
    return [];
  }
}

export function serializeSharedNotes(list: SharedNote[]): string {
  return JSON.stringify(list);
}

/**
 * Applies one operation to the list as it is stored right now.
 *
 * A reorder only moves the notes it names: ids it does not mention keep their relative order at the
 * end, and ids that no longer exist are ignored. So a client reordering a list it read a minute ago
 * cannot delete the note somebody else added in the meantime.
 */
export function applySharedNoteOperation(current: SharedNote[], operation: SharedNoteOperation): SharedNote[] {
  switch (operation.type) {
    case "upsert": {
      const note: SharedNote = { id: operation.id, title: operation.title, text: operation.text };
      const index = current.findIndex((entry) => entry.id === operation.id);
      if (index === -1) return [...current, note];
      const next = current.slice();
      next[index] = note;
      return next;
    }
    case "delete":
      return current.filter((entry) => entry.id !== operation.id);
    case "reorder": {
      const byId = new Map(current.map((entry) => [entry.id, entry] as const));
      const named = operation.ids
        .map((id) => byId.get(id))
        .filter((entry): entry is SharedNote => Boolean(entry));
      const namedIds = new Set(named.map((entry) => entry.id));
      const rest = current.filter((entry) => !namedIds.has(entry.id));
      return [...named, ...rest];
    }
    default:
      return current;
  }
}
