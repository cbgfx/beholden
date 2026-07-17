import multer, { type Options } from "multer";

const uploadLimits: NonNullable<Options["limits"]> & { fieldNestingDepth: number } = {
  fileSize: 100 * 1024 * 1024, // 100MB
  files: 1,
  fields: 20,
  parts: 21,
  fieldNestingDepth: 3,
};

/**
 * Centralized upload middleware.
 * - LAN-only server, but still enforce a sane ceiling to prevent accidental huge uploads.
 * - Memory storage keeps imported compendium data available as req.file.buffer.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: uploadLimits,
});
