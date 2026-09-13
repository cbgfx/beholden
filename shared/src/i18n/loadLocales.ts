type LocaleModule = { default: Record<string, unknown> };
type LocaleLoader = () => Promise<LocaleModule>;

// Turns the object returned by a non-eager `import.meta.glob("./locales/*/index.ts")` into
// `{ [languageCode]: loaderFn }` by reading the language code off the folder name. This is what
// lets a new language be added by dropping a folder — nothing here needs editing, and it isn't
// fetched over the network until something actually calls its loader.
export function mapLocaleLoaders(globResult: Record<string, LocaleLoader>): Record<string, LocaleLoader> {
  const loaders: Record<string, LocaleLoader> = {};
  for (const [path, loader] of Object.entries(globResult)) {
    const match = /\/locales\/([^/]+)\/index\.ts$/.exec(path);
    if (!match) continue;
    loaders[match[1]] = loader;
  }
  return loaders;
}

export async function loadNamespaceBundle(loader: LocaleLoader): Promise<Record<string, unknown>> {
  const mod = await loader();
  return mod.default;
}
