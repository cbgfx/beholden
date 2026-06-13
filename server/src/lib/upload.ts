import multer from "multer";

/**
 * Centralized upload middleware.
 * - LAN-only server, but still enforce a sane ceiling to prevent accidental huge uploads.
 * - Memory storage is required because importXml expects req.file.buffer.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});
