const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/.cache/**",
      "**/*.d.ts",
      ".eslintcache",
    ],
  },
  {
    files: ["server/src/**/*.{ts,tsx}", "shared/src/**/*.{ts,tsx}", "web-dm/src/**/*.{ts,tsx}", "web-player/src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {},
  },
];
