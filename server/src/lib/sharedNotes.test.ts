/**
 * Shared notes live in one JSON string per row, written by three different routes. Changes are sent
 * as operations - one note at a time - so that two people editing at once cannot overwrite each
 * other, and so that a request can never be read as "replace the list with this".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySharedNoteOperation,
  parseSharedNotes,
  serializeSharedNotes,
} from "./sharedNotes.js";

test("an operation applies to the list as it stands, not to the one the client last read", () => {
  const stored = [
    { id: "n1", title: "Downtime Days", text: "4 days" },
    { id: "n2", title: "The ring", text: "Ask at the tavern" },
  ];

  // Editing one note leaves the rest alone, in place.
  assert.deepEqual(
    applySharedNoteOperation(stored, { type: "upsert", id: "n1", title: "Downtime Days", text: "2 days" }),
    [{ id: "n1", title: "Downtime Days", text: "2 days" }, stored[1]],
  );

  // An id nobody has seen is a new note, appended.
  assert.deepEqual(
    applySharedNoteOperation(stored, { type: "upsert", id: "n3", title: "New", text: "x" }).map((note) => note.id),
    ["n1", "n2", "n3"],
  );

  assert.deepEqual(applySharedNoteOperation(stored, { type: "delete", id: "n1" }), [stored[1]]);
  // Deleting what is already gone is not an error.
  assert.deepEqual(applySharedNoteOperation(stored, { type: "delete", id: "nope" }), stored);
});

test("a reorder moves what it names and keeps what it does not", () => {
  const stored = [
    { id: "n1", title: "One", text: "" },
    { id: "n2", title: "Two", text: "" },
    { id: "n3", title: "Three", text: "" },
  ];

  assert.deepEqual(
    applySharedNoteOperation(stored, { type: "reorder", ids: ["n3", "n1", "n2"] }).map((note) => note.id),
    ["n3", "n1", "n2"],
  );

  // A client that read the list before n3 existed can still reorder the two it knows about
  // without deleting the one it never saw.
  assert.deepEqual(
    applySharedNoteOperation(stored, { type: "reorder", ids: ["n2", "n1"] }).map((note) => note.id),
    ["n2", "n1", "n3"],
  );

  // Ids that no longer exist are ignored rather than resurrecting anything.
  assert.deepEqual(
    applySharedNoteOperation(stored, { type: "reorder", ids: ["gone", "n2"] }).map((note) => note.id),
    ["n2", "n1", "n3"],
  );
});

test("reading a stored blob is forgiving, the way every client already is", () => {
  assert.deepEqual(parseSharedNotes(''), []);
  assert.deepEqual(parseSharedNotes(null), []);
  assert.deepEqual(parseSharedNotes("{not json"), []);
  assert.deepEqual(parseSharedNotes('{"id":"n1"}'), [], "an object is not a list");
  // Entries without an id are dropped rather than turning into notes nothing can address.
  assert.deepEqual(parseSharedNotes('[{"title":"orphan"},{"id":"n1","title":"T"}]'), [{ id: "n1", title: "T", text: "" }]);
  assert.equal(serializeSharedNotes([{ id: "n1", title: "T", text: "x" }]), '[{"id":"n1","title":"T","text":"x"}]');
});
