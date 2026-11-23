/**
 * Binder ZIP imports are open to every DM, so their size limits have to hold against a hostile file.
 * The limits used to be checked against the sizes written in the ZIP's own headers, which the file's
 * author controls; they are now checked against what actually comes out of the decompressor.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { zipSync } from "fflate";
import { unzipBinderArchive } from "./core.js";

/** Rewrites every "uncompressed size" field in a ZIP so the headers claim each entry is tiny. */
function understateSizes(zip: Uint8Array): Buffer {
  const out = Buffer.from(zip);
  for (let offset = 0; offset + 4 <= out.length; offset += 1) {
    const signature = out.readUInt32LE(offset);
    // Local file header: uncompressed size at +22. Central directory header: at +24.
    if (signature === 0x04034b50) out.writeUInt32LE(1, offset + 22);
    if (signature === 0x02014b50) out.writeUInt32LE(1, offset + 24);
  }
  return out;
}

test("a well-formed Binder ZIP unpacks binder.json and images, and skips anything else", () => {
  const zip = zipSync({
    "binder.json": new TextEncoder().encode('{"ok":true}'),
    "images/mortals/m1.png": new Uint8Array([1, 2, 3]),
    "notes/ignored.txt": new Uint8Array([4]),
  });
  const entries = unzipBinderArchive(Buffer.from(zip));
  assert.deepEqual(Object.keys(entries).sort(), ["binder.json", "images/mortals/m1.png"]);
  assert.equal(new TextDecoder().decode(entries["binder.json"]), '{"ok":true}');
});

test("an image that lies about its size is refused once its real bytes pass the limit", () => {
  // 11 MB of zeros compresses to almost nothing, and the headers will say it is 1 byte.
  const zip = zipSync({
    "binder.json": new TextEncoder().encode("{}"),
    "images/mortals/m1.png": new Uint8Array(11 * 1024 * 1024),
  });
  assert.throws(() => unzipBinderArchive(understateSizes(zip)), /10 MB limit/);
});

test("an archive whose entries together inflate past 100 MB is refused, whatever its headers say", () => {
  const zip = zipSync({ "binder.json": new Uint8Array(101 * 1024 * 1024) });
  assert.throws(() => unzipBinderArchive(understateSizes(zip)), /100 MB limit/);
});
