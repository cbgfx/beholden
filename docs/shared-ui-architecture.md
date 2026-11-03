# Shared UI ownership

Keep reusable behavior in `shared`; keep app-specific data, defaults, routes and save policies in the owning app.

- `shared/src/domain/layoutColumns.ts` defines persisted column names/icons and their validation. Both clients normalize with it; the server validates writes using the same constants. Domain modules must not import React or UI components.
- `shared/src/ui/ColumnNavigation.tsx` renders column headings and tabs. `useColumnNavigation.ts` owns session-only selection and scroll restoration. Neither saves preferences.
- Character-sheet and DM workspace adapters provide panel labels, default icons and persistence callbacks. Their panel registries and layout restrictions remain app-specific.
- `ModalFrame.tsx` owns portal placement, viewport sizing, focus, Escape and scroll locking. The DM `Modal.tsx` supplies theme colors only.
- `GameIconPickerDialog.tsx` and `gameIconsCollection.ts` provide one searchable icon picker/catalog for Binder and layout editors.
- `LocationMap.tsx` provides attachment controls and an authenticated, scrollable zoom viewer for both apps. The DM host owns uploads/removal and record refresh; the server checks location visibility on every map download. Map limits live in `shared/src/api/locationMaps.ts`.
- `LayoutEditorToolbar.tsx`, `LayoutPanelCard.tsx`, `PanelDragHandle.tsx` and `layoutTheme.ts` provide common editor presentation. App-specific restrictions and disabled-action explanations are passed as props.
- Compendium navigation and browser components live under `shared/src/views/compendium`; editing permissions and extra sections come from each app's host adapter.

Use relative imports within shared components. Export server-consumed domain modules explicitly from `shared/package.json` so NodeNext resolution and production builds agree. Shared interface copy belongs in the shared locale; app-specific copy stays in that app's locale. Do not translate saved names.

Comment non-obvious behavior and ownership decisions. Avoid historical slice notes, comments that restate JSX, and abstractions that merely rename a single operation. Keep app adapters small, and add regression tests where navigation, persistence or validation changes.

Run `npm run verify` for the complete typecheck, lint, tests, production build, payload/bundle budgets and isolated production smoke test. Visual and real-device acceptance remains separate from automated verification.
