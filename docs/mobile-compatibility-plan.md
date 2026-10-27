# Mobile compatibility plan

## Ground rules

**Desktop is the product. Mobile is an adaptation of it, not a migration.**

- Desktop layouts must not change. Every mobile change is gated behind a narrow-screen check and is invisible above it. If a change would alter the desktop experience, it doesn't ship as part of this work.
- Nothing is redesigned phone-first. A phone gets the same views, reorganized to fit: columns stack, sidebars collapse, wide tables become lists.
- No feature is removed from desktop to make mobile easier. A phone may hide or simplify a feature (for example, editing a sheet layout), but the desktop version stays as it is.
- Creation and editing-heavy views are on the back burner (see [Not planned yet](#not-planned-yet)).

## Priority order

1. **Compendium viewer** (shared by the DM and player apps)
2. **Binder viewer** (DM binder and player binder)
3. **Character sheets** (player app)

Everything else waits until these three work well on a phone.

## Conventions

### Detecting a narrow screen

Nearly all layout in both apps is inline `style={{…}}`, which CSS media queries cannot override. Mobile layouts therefore switch in React with a hook, not in stylesheets.

- Use `useIsNarrow("(max-width: 760px)")` as the standard "phone" breakpoint.
- The hook currently lives at `web-dm/src/hooks/useIsNarrow.ts`. Before the player app needs it, move it into `shared/` so both apps use one copy. `web-player/src/views/campaign/PartyMemberView.tsx` hand-rolls the same thing with `window.innerWidth` and should switch to the shared hook.
- Existing breakpoints elsewhere (TopBar's 640px, combat's 980px) stay as they are. Don't retune them as part of this work.

### Layout patterns

Reuse these instead of inventing a new treatment per view:

| Desktop pattern | Phone treatment | Reference |
| --- | --- | --- |
| Fixed-width sidebar beside content | Menu button above the content showing the current section; tapping a link closes it | `web-dm/src/views/BinderView/BinderView.tsx` |
| Wide multi-column table | Card rows: thumbnail, name, one muted summary line, one status badge | `MortalCardRow` in `web-dm/src/views/BinderView/MortalWorkspace.tsx` |
| Row of filter dropdowns | "Filters" toggle button that reveals them | `MortalWorkspace.tsx` |
| Fixed-width search box | Full-width search | `MortalWorkspace.tsx` |
| Record header (portrait, name, action buttons) | Wraps, so actions drop below instead of squeezing the name | `web-dm/src/views/BinderView/BinderRecordDetailShell.tsx` |
| List + detail side by side | List, then a full-screen detail view with a Back button | Compendium (to do) |
| Side drawer | Already fits (`min(…px, 92–94vw)`); leave it | `web-dm/src/components/overlay/Drawer.tsx` |

Sorting by column header isn't available in card mode; the list keeps its default order. That's acceptable for now.

### Images

All portrait uploads go through `imageUploadForm()` in `shared/src/api/imageUpload.ts`. It shrinks images in the browser to at most 1024px before upload and keeps the original if shrinking fails or doesn't help. Any new image upload must use it. The server still re-encodes everything to WebP and applies EXIF rotation (`server/src/lib/imageHelpers.ts`).

## 1. Compendium viewer

One fix covers both apps: the shell is `shared/src/views/compendium/CompendiumView.tsx`, used by `web-dm/src/views/CompendiumView/CompendiumView.tsx` and `web-player/src/views/CompendiumView/CompendiumView.tsx`.

**Problem:** the shell is a fixed three-column grid, `180px / minmax(360px, 1fr) / 420px` (nav, list, detail), so it needs at least ~960px and scrolls sideways on a phone.

**Phone layout:**

- [ ] Section nav (Monsters, Spells, Items, Feats, Rules, plus any extra sections) becomes a compact selector above the list
- [ ] The list fills the screen
- [ ] Selecting an entry opens its detail full-screen, with a Back button returning to the list at the same scroll position and filters
- [ ] Filter bars (`MonsterFilters`, `SpellFilterBar`, item and feat filters) go behind a "Filters" toggle. Their inner grids already use `auto-fit`, so they should reflow once there's room.
- [ ] Check each detail view (`MonsterDetail`, `SpellDetail`, `ItemDetail`, feats) at 360px wide, especially monster statblock tables
- [ ] Rules Reference (no detail column) fills the screen
- [ ] DM-only extra sections (Compendium admin, AI Guide) are reachable but don't need a phone layout

## 2. Binder viewer

### DM binder (`web-dm/src/views/BinderView/`)

Done:

- [x] Sidebar collapses to a menu button (`BinderView.tsx`)
- [x] Mortals list uses card rows, a full-width search and a filters toggle (`MortalWorkspace.tsx`)
- [x] Record detail header wraps (`BinderRecordDetailShell.tsx`)
- [x] Mortal page: tap the empty portrait to add one, or the camera badge to replace it. Uploads straight away, with no edit drawer.
- [x] Phone photos are shrunk before upload and stored upright

Remaining workspaces, each a fixed-column table that needs card rows on a phone:

- [ ] Places (`PlacesWorkspace.tsx`): `minmax(240px,1.4fr) 170px minmax(220px,1fr) 110px`
- [ ] Reference records: deities, organizations, positions, races, domains and place types (`ReferenceWorkspace.tsx`)
- [ ] Lore: items and events (`BinderLoreWorkspace.tsx`)
- [ ] Players (`BinderPlayersWorkspace.tsx`)
- [ ] Campaigns table and campaign workspace (`BinderView.tsx`, `BinderCampaignWorkspace.tsx`)
- [ ] Health (`BinderHealthWorkspace.tsx`): `minmax(180px,1fr) 2fr`
- [ ] Dashboard (`BinderDashboard.tsx`): already `auto-fit`, so only needs checking
- [ ] Deity detail page: same one-tap portrait upload as Mortals
- [ ] `BinderDataTableHeader` in `shared/src/ui/BinderDataTable.tsx` hard-codes `minWidth: 1120`. Fine on desktop; card mode just skips it.

### Player binder (`web-player/src/views/binder/PlayerBinderView.tsx`)

Same problems as the DM side, in one large file:

- [ ] 260px sidebar beside the content becomes a menu button
- [ ] Record tables (including the Mortals table at `minWidth: 1160`) become card rows. Consider sharing `MortalCardRow` through `shared/src/ui/` instead of writing it twice.
- [ ] Fixed-width controls (360px, 300px) become full width when narrow
- [ ] Detail pages: the fact grid already uses `auto-fit, minmax(280px, 1fr)`; check at 360px

## 3. Character sheets (player app)

**Problem:** the sheet is built from player-defined views with 1–5 columns. `CharacterViewLayout.tsx` sets `minWidth={columns * 380}`, so any view with two or more columns scrolls sideways on a phone.

**Phone layout:**

- [ ] Stack every view into a single column on a phone, reading the saved layout column by column. The saved layout itself is never changed; on desktop it renders exactly as before.
- [ ] Layout editing (drag panels, add or remove columns) stays desktop-only. Hide the layout editor toolbar on a phone rather than adapting it.
- [ ] Go through each panel at 360px. Known spots: `CharacterCountersPanel` (5-column row), `CharacterSkillsPanel` (two columns, likely fine), `CharacterViewFeatureParts`.
- [ ] Drawers and modals: `CharacterInfoDrawer` (three-column grids), `CharacterPermanentBuffsDrawer`, `CharacterFeatPickerModal` (two-pane `1fr 1.15fr`, should become list then detail)
- [ ] Inventory, spells and HUD popups (`CharacterHudXpPopup`, inventory sections with fixed widths)
- [ ] Tap targets: anything you'd use mid-session (HP, slots, counters, rolls) should be comfortably tappable

## Not planned yet

These stay desktop-only until the three priorities are done:

- Character creator and level-up. The creator already collapses to one column below 960px, but no further work is planned.
- DM compendium editors (`web-dm/src/views/CompendiumView/panels/`)
- DM admin, profile and home views
- DM combat tracker (already has a narrow mode; not extending it now)
- Mortal and record edit drawers beyond "they fit". Full-screen editing on a phone isn't a goal.

## Checking a change

For every mobile change:

1. **Desktop first.** Open the view at a normal desktop width and confirm nothing moved.
2. Check at 390px (typical iPhone) and 360px (small Android) wide. The page must not scroll sideways.
3. Try it on a real phone when touch matters (uploads, drag, small buttons): iOS Safari and Android Chrome if possible.
4. New `translateUi`/`translateMessage` strings need French copy in the app's `i18n/locales/fr/ui.ts`, or `i18n.test.ts` fails.
5. `npm run typecheck`, `npm run lint` and the affected workspace's tests pass.
