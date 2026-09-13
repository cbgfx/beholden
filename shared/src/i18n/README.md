# Frontend localization

Player and DM each own an i18next instance and a language provider. Shared components use that provider. English is the bundled fallback; French is loaded from a single same-origin, hashed `locale-fr` asset when selected. No translation service, polling, or backend language field is involved.

The selector is available at login and in account settings. The selected language is stored in this browser origin's `beholden_language` key; browser language is used when there is no saved selection. Storage failure leaves language switching usable. Failed downloads preserve the current UI and can be retried. Switching language preserves mounted forms and unsaved edits.

## Writing interface copy

- Existing feature keys live in matching `locales/en` and `locales/fr` modules. Export each module from its language index.
- Additional interface copy uses English source keys in `useUiTranslation("playerUi" | "dmUi" | "sharedUi")`. Put French equivalents in the corresponding `locales/fr/ui.ts`. English source text is the fallback, so a second copy of the entire English interface is not downloaded.
- Use interpolation for values, for example `translateUi("Level {{value1}}", { value1: level })`. Keep placeholder names identical in French.
- Use `useUiMessages` for callbacks involved in data loading, subscriptions, or saving. Its identity stays stable when the language changes. Use `useUiTranslation` for render-time labels and memoized presentation data.
- Pure Player/DM render helpers may use their application's `translateUi` function when their owning component subscribes to language changes. Never evaluate translations in module-level constants.
- Translate known interface labels only. Preserve IDs, option values, rule identifiers, saved names, notes, descriptions, and imported compendium text. Localize the display without rewriting persisted records. Existing compendium content stays in its source language.
- Pass the selected language explicitly to number-formatting helpers. Translating unit labels does not convert distances or weights.

## Verification

The frontend tests cover catalog registration, interpolation compatibility, independent application instances, request deduplication, failed-load retries, rapid language changes, inaccessible storage, document language, and preservation of mounted inputs. Root `npm run verify` also checks initial JavaScript size and that each application's French bundle stays on demand and below its size budget.
