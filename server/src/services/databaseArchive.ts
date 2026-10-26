import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Unzip, UnzipInflate } from "fflate";
import { isDatabaseImagePath, type RestoreImage } from "./databaseImageArchive.js";

export const DATABASE_ARCHIVE_LIMITS = {
  entries: 10_000,
  databaseBytes: 1024 * 1024 * 1024,
  imageBytes: 32 * 1024 * 1024,
  expandedBytes: 2 * 1024 * 1024 * 1024,
};
type Limits = typeof DATABASE_ARCHIVE_LIMITS;
const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });

/** Extract selected entries incrementally to disk, bounding declared and actual output.
 * Unknown files are skipped without starting a decompressor. ZIP names never become staging paths. */
export async function extractDatabaseArchive(uploadedPath: string, limits: Limits = DATABASE_ARCHIVE_LIMITS, signal?: AbortSignal) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-restore-"));
  const open = new Set<number>();
  const accepted = new Set<string>();
  const images: RestoreImage[] = [];
  let databasePath: string | null = null;
  let entries = 0; let declared = 0; let expanded = 0; let unfinished = 0;
  const dispose = () => { try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* staging cleanup must not change the restore result */ } };
  try {
    const unzip = new Unzip(file => {
      if (file.name.length > 1024) throw invalid("Database ZIP entry name is too long.");
      if (++entries > limits.entries) throw invalid("Database ZIP contains too many entries.");
      declared += file.originalSize ?? 0;
      if (declared > limits.expandedBytes) throw invalid("Database ZIP exceeds its expanded-size limit.");
      const isDatabase = file.name === "beholden.db";
      if (!isDatabase && !isDatabaseImagePath(file.name)) return;
      const maximum = isDatabase ? limits.databaseBytes : limits.imageBytes;
      if ((file.originalSize ?? 0) > maximum) throw invalid("Database ZIP entry exceeds its size limit.");
      const key = file.name.toLowerCase();
      if (accepted.has(key)) throw invalid("Database ZIP contains duplicate entries.");
      accepted.add(key);
      const stagedPath = path.join(directory, `${entries}.staged`);
      const descriptor = fs.openSync(stagedPath, "wx"); open.add(descriptor); unfinished++;
      let written = 0;
      file.ondata = (error, bytes, final) => {
        if (error) {
          if ("status" in error) throw error;
          throw invalid("Database ZIP contains an invalid compressed entry.");
        }
        written += bytes.length; expanded += bytes.length;
        if (written > maximum || expanded > limits.expandedBytes) throw invalid("Database ZIP exceeds its expanded-size limit.");
        let offset = 0;
        while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
        if (final) { fs.closeSync(descriptor); open.delete(descriptor); unfinished--; }
      };
      if (isDatabase) databasePath = stagedPath;
      else images.push({ relativePath: file.name, stagedPath });
      file.start();
    });
    unzip.register(UnzipInflate);
    // Small async reads bound decoder bursts and allow unrelated requests to make progress.
    const input = fs.createReadStream(uploadedPath, { highWaterMark: 8 * 1024, ...(signal ? { signal } : {}) });
    for await (const chunk of input) {
      if (signal?.aborted) throw invalid("Database restore was cancelled.");
      unzip.push(Uint8Array.from(chunk as Buffer));
    }
    unzip.push(new Uint8Array(), true);
    if (!databasePath || unfinished !== 0) throw invalid("Database ZIP is incomplete or does not contain beholden.db.");
    return { databasePath, images, dispose };
  } catch (cause) {
    for (const descriptor of open) { try { fs.closeSync(descriptor); } catch { /* already closed */ } }
    dispose();
    if (cause instanceof Error && "status" in cause) throw cause;
    throw invalid("Uploaded ZIP is invalid or incomplete.");
  }
}
