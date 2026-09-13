import enShared from "./en";

// English ships in every bundle unconditionally (it's the fixed fallback/default language).
// Every other language's loader is discovered by each *app's* own i18n bootstrap (not here) —
// import.meta.glob only gets Vite/Vitest's glob transform applied to the file that calls it, and
// a call living inside this cross-package module doesn't get that transform when consumed from
// an app's build/test context, even though the same call works fine from inside the app itself.
export const sharedDefaultResources = enShared;
