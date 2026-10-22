import { readFileSync } from "node:fs";

const requiredNotices = readFileSync(new URL("../../NOTICE", import.meta.url), "utf8")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("Required Notice:"));
if (requiredNotices.length === 0) throw new Error("NOTICE must include the required author attribution");

// Keep attribution with compiled copies too. This covers original Beholden
// software; it does not relicense dependencies included in a browser chunk.
export const licenseBanner = [
  "/*!",
  ...requiredNotices,
  "Original Beholden software: https://polyformproject.org/licenses/noncommercial/1.0.0",
  "Third-party components retain their respective licenses.",
  "*/",
].join("\n");

export const licenseNoticePlugin = {
  name: "beholden-license-notices",
  augmentChunkHash() { return licenseBanner; },
  generateBundle(_options, bundle) {
    // Add notices after minification, which otherwise strips output banners.
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk") output.code = `${licenseBanner}\n${output.code}`;
    }
  },
};
