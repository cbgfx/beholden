# Binder Technical Implementation Plan

Status: backend foundation and initial DM CRUD slices in progress.

### Implementation progress

Completed in the first backend foundation pass:

- core Binder SQLite tables and indexes;
- idempotent nullable Campaign `binder_id` and campaign date migration;
- narrow `binder_records` identity registry;
- explicit `mortals.mortal_type` plus mandatory `binder_npcs` or `binder_player_characters` service transactions;
- nullable NPC `monster_id` and nullable Player Character `character_id`;
- typed core tables for Deities, Races, Positions, Organizations/memberships, Continents, Countries, Locations, POIs, Events/associations, mentions, and import audit/identity;
- normalized Binder-scoped Event tags and Event/tag links;
- Binder owner/admin authorization;
- automatic read access for DMs on an attached Campaign;
- Binder list/create/read/update/delete API;
- authorized Campaign-to-Binder assignment API;
- optional Binder/date fields in existing Campaign DTOs;
- fresh-schema, subtype, authorization, and Campaign-assignment regression tests;
- DM home-page Binder listing, creation, rename, deletion, and overview routing;
- styled Binder create/rename modal and compact Campaign/Binder home layout;
- shared Campaign, Binder, and Players icon treatment across the DM and player home pages;
- Campaign edit controls for nullable Binder assignment and structured campaign current date;
- Binder workspace shell with grouped navigation and stable section routes;
- attached Campaign table and structured empty-table states for typed record categories;
- Binder theme colors persisted in SQLite and applied to cards, workspace navigation, hover states, and table accents.
- pre-CRUD unset-state convention enforced: optional Binder scalars/foreign keys
  use `NULL`, optional associations use zero rows, and Player Character sheet
  links are nullable with `ON DELETE SET NULL`.
- complete first typed CRUD vertical slice for Binder Races, Positions, and
  Domains: authorized/searchable APIs, themed list tables, create/edit forms,
  generated detail views, usage counts, and guarded deletion. Player-sharing
  visibility remains deferred and is not exposed in these DM-only forms.
- Mortal CRUD and generated detail pages, including explicit NPC/Player
  Character classification, searchable nullable Race/Location/Organization/
  Position fields, primary membership projection, structured gender and life
  status, birth/death dates, one Notes field, portraits, optional campaign
  Player/fake-PC linkage, atomic subtype conversion, search, and deletion.
- development-only Notion ZIP importer CLI with direct ZIP parsing, database
  inventory, typed page-ID correlation, dry-run by default, explicit ignored
  and unresolved-data reporting, placeholder `None` suppression, Markdown
  content preservation, source fingerprint duplicate prevention, external
  Notion identity storage, and one-transaction commit/rollback. The supplied
  export dry-runs as 751 core records with seven ambiguity warnings and 43
  distinct unresolved forward relations.
- the reviewed Notion ZIP was committed locally to Tarentha on 2026-07-25:
  751 structured records were imported and `currentDate` was set to 2438.
  Unsupported Items remain reported and unimported, Loot Table remains
  intentionally ignored, unresolved relations remain unset, the completed
  fingerprint prevents an accidental duplicate import, and
  `PRAGMA foreign_key_check` reports no violations.

Not yet implemented:

- typed CRUD routes for the remaining Binder record categories;
- a production Notion import UI (intentionally omitted; the current importer is
  a local-only CLI because this migration will not ship);
- typed CRUD and generated record pages behind the Binder workspace navigation;
- stable mention editing/rendering;
- all explicitly deferred secondary phases.

### Next implementation slice

1. Implement Organizations and membership/Position history using the completed
   reference CRUD conventions.
2. Implement Places in hierarchy order: Continents, Countries, Locations, POIs.
3. Implement Deities and their Domain associations.
4. Implement Events after the related typed records are stable.
5. Add stable internal mention resolution using the existing text storage/rendering conventions.
6. Review the supplied Notion dry-run report, commit it locally when approved,
   and use the resulting records to drive the remaining typed CRUD slices.
7. Add canonical Binder JSON import/export after the core schema stabilizes;
   reuse the Notion transform output rather than making Notion ZIP the canonical
   interchange format.

This plan is based on an inspection of the current Beholden source tree and the supplied `Notion.zip` export. Binder is the product term throughout. Binder belongs in the existing DM application and existing backend; it does not require a third frontend or a new service.

## 1. Executive decisions

The recommended architecture is:

- Keep the current TypeScript monorepo, Express server, `better-sqlite3`, React/Vite clients, JWT authentication, Zod validation, shared browser API client, and WebSocket update model.
- Add Binder to `web-dm`, the existing server, and the existing SQLite database.
- Add a narrow `binder_records` identity registry for stable cross-type identity, routing, visibility, mentions, event participation, and search. Keep actual data in typed tables such as `mortals`, `deities`, `binder_organizations`, and `binder_locations`.
- Keep Mortals and Deities separate. Every Mortal has exactly one explicit subtype row: either NPC or Player Character. NPC status is never inferred from a missing character link.
- Keep Continent, Country, Location, and Point of Interest as separate typed tables. Do not replace them with one generic Place table.
- Link existing campaigns with nullable `campaigns.binder_id`; do not create Binder-owned campaign copies.
- Store initial setting dates as a human-readable value plus an optional sortable integer. Custom calendar definitions and calendar UI are deferred.
- Derive history from Events and organization rosters from membership rows. Do not copy those descriptions or lists onto related records.
- Store internal rich-text mentions by stable record ID in a versioned structured document, never by name or permanent raw URL.
- Enforce all player visibility and field-level editing on the server with response projection and endpoint-specific allowlists.
- Import Notion in two stages: deterministic dry-run/validation, followed by one SQLite transaction plus staged file promotion.
- Deliver a deliberately narrow first phase: Binder/campaign assignment, core typed lore records, explicit Mortal subtypes, Events, stable mentions, and Notion preview/import. Player sharing/editing, combat, advanced media, custom calendars, Binder collaborators, and full-text search follow only after the imported core is stable.

### Approved initial implementation scope

The initial implementation includes only:

- Binder and nullable Campaign assignment/date override;
- Mortals with a mandatory, explicit NPC or Player Character subtype;
- Deities;
- Binder-scoped Races and Positions;
- Organizations and membership history;
- Continents, Countries, Locations, and Points of Interest;
- Events and typed associations;
- basic stable internal record-ID mentions using existing editor/storage conventions where practical;
- Notion ZIP preview and import.

The initial implementation explicitly excludes player sharing/editing, combat integration, advanced media handling, custom calendars, Binder collaborators, FTS, public publishing, and secondary integration systems.

## 2. Existing architecture assessment

### Repository and runtime

Beholden is an npm-workspace TypeScript monorepo:

- `server`: Express 5 API, `better-sqlite3`, Zod, JWT, Multer, Sharp, and `ws`.
- `web-dm`: React 19, React Router, Vite, and Vitest.
- `web-player`: a separate React/Vite client using the same server.
- `shared`: shared API helpers, types, styles, and UI components.
- `compendium`: global game-mechanics content, intentionally separate from campaign data.

Production can serve both built clients from the Node server, while the documented Railway arrangement can deploy the API, DM static client, and player static client separately from the same repository. The user-facing services remain `dm.beholdenapp.com` and `player.beholdenapp.com`; Binder adds routes and chunks to the DM client and routes to the existing API. It does not add a Binder deployment, domain, process, database, or service.

### Database conventions

The source of truth is `server/src/lib/dbSchema.ts`. The database is one SQLite file opened by `server/src/lib/db.ts` with:

- `PRAGMA foreign_keys = ON`
- WAL journaling
- string IDs generated by the existing `uid()` helper
- millisecond epoch integer `created_at` and `updated_at`
- snake_case database columns and camelCase API objects
- explicit foreign keys and `ON DELETE` behavior
- JSON text columns for cohesive embedded state, not arbitrary user-defined properties
- direct prepared SQL rather than an ORM
- startup-safe schema creation plus small idempotent migration helpers for existing databases
- synchronous transactions through `db.transaction(...)`

Binder should follow those conventions. No ORM or schema framework should be introduced. Because Binder adds many related tables, its schema should be split into a dedicated `server/src/lib/binderSchema.ts` string called from `openDb`, while narrowly scoped legacy-column migrations such as adding `campaigns.binder_id` remain idempotent startup migrations. This keeps `dbSchema.ts` navigable without changing the migration approach.

The present schema does not maintain a numbered migration ledger. Before Binder ships, add a small internal `schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)` table or retain individually idempotent migration functions. A migration ledger is preferable for the multi-step Binder change, but it is not an ORM or new database system.

### Authentication and authorization

All `/api/*` endpoints except health and login pass through JWT authentication. JWTs contain `userId`, `username`, and `isAdmin`; current user and membership state is re-read from SQLite where needed.

Authorization is currently:

- global administrator access;
- campaign membership with `dm` or `player` roles;
- `dmOrAdmin` and `memberOrAdmin` middleware that resolve direct or indirect campaign IDs;
- ownership checks for `user_characters`;
- server-side response shaping for player-facing data.

Binder needs equivalent Binder-scoped middleware rather than scattered route checks. Existing campaign membership alone is not sufficient to edit a Binder: a campaign DM should not silently gain write access to all setting lore merely because one campaign is attached.

### API and server organization

Routes are registered centrally in `createServer.ts`, with domain handlers under `server/src/routes`, Zod parsing through shared validation helpers, prepared SQL, and broadcasts after successful mutations. The frontend uses the shared authenticated `api`, `apiCoalesced`, `apiBlob`, and `jsonInit` helpers. Binder should follow the same pattern:

- `server/src/routes/binders/*` for route modules;
- `server/src/services/binders/*` for projection, authorization queries, search, mentions, and import logic that is too large for handlers;
- `shared/src/api/binder.ts` for DTOs used by both clients;
- no GraphQL layer and no second API style.

### Frontend patterns

Both clients use React Router with lazy-loaded major views. The DM app already has:

- a top-level shell and navigation;
- a home/campaign selection flow;
- three-column campaign workspaces;
- shared panels, drawers, list shells, form fields, selectors, and rich-text-related components;
- feature-specific services and hooks;
- WebSocket scope updates and REST bootstrap requests.

Binder should be a lazy-loaded top-level DM workspace, not another campaign tab and not another site. Binder pages should reuse the existing visual language, list/detail panels, right drawers, form controls, empty states, and debounced save patterns. Granular record-page layout should follow the schema and query needs, not precede them.

### Existing domain boundaries to preserve

- `campaigns`, adventures, encounters, campaign notes, party inventory, and combat state remain campaign data.
- `user_characters` remains the canonical player-owned mechanical sheet.
- `players` remains the campaign projection/link for a character.
- `compendium_*` remains global mechanics.
- Binder stores setting identity and lore.
- Binder Items can reference `compendium_items`; NPC extensions can reference `compendium_monsters`; neither copies compendium data.
- Existing campaign Notes remain supported for backward compatibility but are deprecated as a pattern for new Binder work.

### Existing concerns Binder should not copy blindly

- Static image directories are currently served without record-level authorization. Hidden Binder media must not use guessable public static URLs; it needs an authenticated media route or signed/opaque access mechanism.
- WebSocket connections are authenticated, but client-selected scopes are not currently authorization-checked and broadcasts are broad. Binder events must contain no secret content and should prompt an authorized REST refetch. Binder scope subscription should be checked against the authenticated user before use.
- Some older routes centralize authorization less consistently than newer campaign middleware. New Binder routes should uniformly use Binder middleware and projection services.

## 3. Proposed database schema

### Naming and common rules

- IDs: existing opaque string IDs from `uid()`.
- Timestamps: integer epoch milliseconds.
- Booleans: integer with `CHECK(value IN (0,1))`.
- Visibility: `CHECK(visibility IN ('dm','campaign','public'))`.
- Name lookup: store `name` plus `name_key`, using the existing normalization helper.
- Rich text: versioned JSON text validated by Zod at API and import boundaries.
- Optional scalar fields and nullable foreign keys use SQL `NULL`; optional
  many-to-many relationships use zero association rows.
- Never persist the literal string `None`, create fake records named `None`, or
  use empty strings as substitutes for an unset value.
- Every optional selector includes a built-in `None` option. Selecting it writes
  `NULL` or removes the association row, and filters support unset relationships.
- Validation distinguishes omitted or explicitly cleared values from malformed
  IDs and cross-Binder references; malformed and cross-Binder IDs are errors.
- Dates: `*_date_text` preserves setting-facing text; `*_date_sort` is an optional signed integer ordinal used for ordering. For the supplied data it is the signed year. A later custom calendar can convert a full date to a monotonic ordinal without changing event queries.
- Every typed Binder record has a one-to-one row in `binder_records`.
- Binder consistency across related rows is enforced in service validation and import validation. Where SQLite can enforce it naturally, use foreign keys and unique constraints.

### Binder ownership and access

#### `binders`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `owner_user_id` | `TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT` |
| `name` | `TEXT NOT NULL` |
| `name_key` | `TEXT NOT NULL` |
| `description_json` | `TEXT NOT NULL DEFAULT '{"version":1,"nodes":[]}'` |
| `current_date_text` | `TEXT` |
| `current_date_sort` | `INTEGER` |
| `created_at` | `INTEGER NOT NULL` |
| `updated_at` | `INTEGER NOT NULL` |

Indexes:

- `idx_binders_owner_updated(owner_user_id, updated_at DESC)`
- `idx_binders_name(name COLLATE NOCASE)`

`owner_user_id` is explicit and authoritative. Deleting a user who owns a Binder is restricted until ownership is transferred or the Binder is explicitly deleted.

Binder collaborators are deferred. In the initial implementation, the Binder owner and global administrators are the only Binder writers/readers. A future `binder_membership` table may follow the existing campaign-membership convention when multi-DM Binder collaboration is designed.

### Stable record identity

#### `binder_records`

This is a narrow identity/authorization registry, not a generic entity data table:

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `binder_id` | `TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE` |
| `record_type` | checked `TEXT`: `mortal`, `deity`, `race`, `position`, `organization`, `domain`, `continent`, `country`, `location`, `poi`, `item`, or `event` |
| `name` | `TEXT NOT NULL` |
| `name_key` | `TEXT NOT NULL` |
| `visibility` | `TEXT NOT NULL DEFAULT 'dm' CHECK(...)` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

Constraints and indexes:

- `UNIQUE(binder_id, id)` to support composite reference checks if needed.
- Do **not** make names unique; the export contains duplicate names.
- `idx_binder_records_type_name(binder_id, record_type, name_key, id)`
- `idx_binder_records_updated(binder_id, updated_at DESC)`
- `idx_binder_records_visibility(binder_id, visibility, record_type)`

The typed row uses the same ID as its registry row and references it with `ON DELETE CASCADE`. Creation/deletion occurs in a transaction so there is never an orphan registry row.

#### `binder_record_aliases`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `record_id` | `TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE` |
| `alias` | `TEXT NOT NULL` |
| `alias_key` | `TEXT NOT NULL` |
| `sort` | `INTEGER NOT NULL DEFAULT 0` |

Constraint: `UNIQUE(record_id, alias_key)`. Index: `idx_binder_alias_lookup(alias_key, record_id)`.

#### `binder_record_campaign_visibility`

Explicitly identifies which attached campaigns can see a record whose visibility is `campaign`.

| Column | Definition |
|---|---|
| `record_id` | `TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE` |
| `campaign_id` | `TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE` |
| primary key | `(record_id, campaign_id)` |

The service verifies the campaign belongs to the same Binder. No rows means no player can see a `campaign` record; this fail-closed rule avoids accidental broad exposure.

### Campaign changes

Add to `campaigns`:

| Column | Definition |
|---|---|
| `binder_id` | `TEXT REFERENCES binders(id) ON DELETE SET NULL` |
| `current_date_text` | `TEXT` |
| `current_date_sort` | `INTEGER` |

Indexes:

- `idx_campaigns_binder(binder_id, updated_at DESC)`

Existing campaigns migrate with all three fields `NULL`. Deleting a Binder detaches campaigns instead of deleting them. Campaign dates are independent optional values; they do not overwrite Binder current date. A UI may display the Binder date as a fallback, but API data must distinguish an explicit campaign date from a displayed fallback.

Binder assignment is a campaign mutation requiring both:

- `dm` access to the campaign (or administrator); and
- Binder owner access (or administrator) in the initial implementation.

Detaching requires campaign DM/admin access. This prevents attaching a campaign to someone else’s Binder merely by knowing an ID.

### Mortals and extensions

#### `mortals`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `race_id` | `TEXT REFERENCES binder_races(id) ON DELETE SET NULL` |
| `gender` | `TEXT` |
| `life_status` | `TEXT` nullable; e.g. alive, deceased, unknown |
| `birth_date_text`, `birth_date_sort` | `TEXT`, `INTEGER` |
| `death_date_text`, `death_date_sort` | `TEXT`, `INTEGER` |
| `description_json` | versioned rich text, non-secret |
| `backstory_json` | versioned rich text, potentially player-editable |
| `dm_notes_json` | versioned rich text, always DM-only |
| `residence_record_id` | `TEXT REFERENCES binder_records(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

`residence_record_id` must resolve to a place type in the same Binder; this is validated in the service. An explicit polymorphic place reference is justified here because all place types share stable `binder_records` identity.

Indexes:

- `idx_mortals_race(race_id)`
- `idx_mortals_residence(residence_record_id)`
- `idx_mortals_birth(birth_date_sort)`

Age is derived from the relevant Binder/campaign reference date and birth date when possible; it is not canonical stored state. Imported age can appear in the import report when inconsistent.

#### `binder_npcs`

| Column | Definition |
|---|---|
| `mortal_id` | `TEXT PRIMARY KEY REFERENCES mortals(id) ON DELETE CASCADE` |
| `monster_id` | `TEXT REFERENCES compendium_monsters(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

Every NPC has this row, including shopkeepers and all other NPCs with no combat statblock. `monster_id` is nullable. NPC status is explicit and is never inferred from the absence of a Player Character row.

#### `binder_player_characters`

| Column | Definition |
|---|---|
| `mortal_id` | `TEXT PRIMARY KEY REFERENCES mortals(id) ON DELETE CASCADE` |
| `character_id` | `TEXT UNIQUE REFERENCES user_characters(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

The subtype row is mandatory, but the mechanical link is optional. An unlinked
Binder Player Character remains valid for web-dm fake PCs, external sheets,
pen-and-paper play, and imported lore. When linked, the owning player is derived
from `user_characters.user_id`; do not duplicate it. Unlinking or deleting the
sheet sets `character_id` to `NULL` and never deletes or retypes the Binder PC.
Mechanical fields remain on `user_characters`.

Database triggers reject a Mortal that has both subtype rows. Service transactions guarantee that every committed Mortal has one subtype row. All Mortal create/type-conversion operations insert/delete the Mortal and subtype rows atomically. Integrity tests assert exactly one subtype row for every Mortal.

### Deities and domains

#### `deities`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `rank` | `TEXT` |
| `description_json` | versioned rich text |
| `dm_notes_json` | versioned rich text, DM-only |
| `primary_location_record_id` | `TEXT REFERENCES binder_records(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

#### `binder_domains`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `description_json` | versioned rich text |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

#### `deity_domains`

| Column | Definition |
|---|---|
| `deity_id` | `TEXT NOT NULL REFERENCES deities(id) ON DELETE CASCADE` |
| `domain_id` | `TEXT NOT NULL REFERENCES binder_domains(id) ON DELETE CASCADE` |
| primary key | `(deity_id, domain_id)` |

Pantheons are not required by the supplied database schema. If retained after product confirmation, use `deity_groups`, `deity_group_membership`, and generated membership lists; do not put a comma-separated pantheon field on Deity.

### Reference records and organizations

#### `binder_races`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `description_json` | versioned rich text |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

This is setting lore and is unrelated to `compendium_races`.

#### `binder_positions`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `description_json` | versioned rich text |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

#### `binder_organizations`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `description_json` | versioned rich text |
| `dm_notes_json` | versioned rich text, DM-only |
| `leader_mortal_id` | nullable current leader; `TEXT REFERENCES mortals(id) ON DELETE SET NULL` |
| `headquarters_record_id` | `TEXT REFERENCES binder_records(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

`leader_mortal_id` is the product's explicit current Leader field. It defaults to
`NULL`, must resolve to a Mortal in the same Binder, and is cleared if that Mortal
is deleted. Other offices remain modeled through memberships and Positions.

#### `organization_memberships`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `organization_id` | `TEXT NOT NULL REFERENCES binder_organizations(id) ON DELETE CASCADE` |
| `mortal_id` | `TEXT NOT NULL REFERENCES mortals(id) ON DELETE CASCADE` |
| `position_id` | `TEXT REFERENCES binder_positions(id) ON DELETE SET NULL` |
| `role_label` | `TEXT` |
| `start_date_text`, `start_date_sort` | `TEXT`, `INTEGER` |
| `end_date_text`, `end_date_sort` | `TEXT`, `INTEGER` |
| `notes_json` | versioned rich text |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

Constraint to prevent exact duplicates:

`UNIQUE(organization_id, mortal_id, position_id, start_date_text)`.

Indexes:

- `idx_org_membership_org_current(organization_id, end_date_sort, position_id)`
- `idx_org_membership_mortal(mortal_id, start_date_sort)`
- `idx_org_membership_position(position_id, organization_id)`

Historical rosters and positions are generated from these rows. The Notion
`Organization.Leader` relation imports into `leader_mortal_id`; a corresponding
membership is imported only when the source data independently expresses one.

### Places

The four place types remain understandable and enforce their expected hierarchy with ordinary foreign keys.

#### `binder_continents`

`id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE`, `description_json TEXT`, `created_at`, `updated_at`.

#### `binder_countries`

| Column | Definition |
|---|---|
| `id` | registry PK/FK |
| `continent_id` | `TEXT REFERENCES binder_continents(id) ON DELETE RESTRICT` |
| `description_json` | versioned rich text |
| timestamps | integers |

Index: `idx_binder_countries_continent(continent_id)`.

#### `binder_locations`

| Column | Definition |
|---|---|
| `id` | registry PK/FK |
| `country_id` | `TEXT REFERENCES binder_countries(id) ON DELETE RESTRICT` |
| `description_json` | versioned rich text |
| timestamps | integers |

Index: `idx_binder_locations_country(country_id)`.

Continent for a Location is derived through Country. The importer validates the redundant Notion Location `Continent` relation and reports disagreement rather than storing it twice.

#### `binder_points_of_interest`

| Column | Definition |
|---|---|
| `id` | registry PK/FK |
| `location_id` | `TEXT REFERENCES binder_locations(id) ON DELETE RESTRICT` |
| `country_id` | `TEXT REFERENCES binder_countries(id) ON DELETE RESTRICT` |
| `parent_poi_id` | self-reference `TEXT REFERENCES binder_points_of_interest(id) ON DELETE RESTRICT` |
| `description_json` | versioned rich text |
| timestamps | integers |

Check constraint: no more than one of `location_id`, `country_id`, and `parent_poi_id` is non-null. A temporarily unplaced POI is allowed, because all 13 exported POIs lack parent columns. Service validation rejects self-parenting, cycles, and cross-Binder parents.

Indexes:

- `idx_poi_location(location_id)`
- `idx_poi_country(country_id)`
- `idx_poi_parent(parent_poi_id)`

`ON DELETE RESTRICT` is intentional for place hierarchy: the DM must reparent children before deleting a parent, avoiding silent destruction or orphaning of whole regions.

### Items

#### `binder_items`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `description_json` | versioned rich text |
| `dm_notes_json` | versioned rich text, DM-only |
| `compendium_item_id` | `TEXT REFERENCES compendium_items(id) ON DELETE SET NULL` |
| `current_holder_mortal_id` | `TEXT REFERENCES mortals(id) ON DELETE SET NULL` |
| `current_location_record_id` | `TEXT REFERENCES binder_records(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

Indexes on compendium item, current holder, and current location.

The current holder/location fields represent current state. Previous holders, creation, loss, destruction, and movement are Events. Campaign relevance uses `binder_item_campaigns(item_id, campaign_id)` with a composite primary key and cascade on either side; it does not copy the Item.

### Events and derived history

#### `binder_events`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE` |
| `description_json` | versioned rich text |
| `date_text`, `date_sort` | `TEXT`, `INTEGER` |
| `end_date_text`, `end_date_sort` | `TEXT`, `INTEGER` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

Title and visibility live in `binder_records`. Timeline is a query/view over Events ordered by `date_sort`; it is not a table.

#### `binder_event_records`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `event_id` | `TEXT NOT NULL REFERENCES binder_events(id) ON DELETE CASCADE` |
| `record_id` | `TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE` |
| `role` | `TEXT` nullable |
| `description` | `TEXT` nullable, concise association context |
| `sort` | `INTEGER NOT NULL DEFAULT 0` |

Constraint: `UNIQUE(event_id, record_id, role)`.

Indexes:

- `idx_event_records_record(record_id, event_id)`
- `idx_event_records_event(event_id, sort)`

Any Mortal, Deity, Organization, Item, or Place has history by joining this table to visible Events. `record_id` may not be the Event itself.

#### `binder_event_tags` and `binder_event_tag_links`

Event Type is structured, Binder-scoped reference data:

- `binder_event_tags`: `id`, `binder_id` FK cascade, `name`, `name_key`, timestamps, and `UNIQUE(binder_id, name_key)`.
- `binder_event_tag_links`: `event_id` and `tag_id` with a composite primary key and cascade deletion.

The Notion Timeline `Type` column imports through these tables. Tags are normalized and reusable; Events do not store comma-separated type strings.

#### `binder_event_campaigns`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `event_id` | `TEXT NOT NULL REFERENCES binder_events(id) ON DELETE CASCADE` |
| `campaign_id` | `TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE` |
| `role` | `TEXT` |
| `description` | `TEXT` |

Constraint: `UNIQUE(event_id, campaign_id, role)`.

Campaign is kept separate because it is an existing record, not a Binder record. Services validate that the campaign is attached to the Event’s Binder.

The Event description is canonical. Association descriptions add only a role-specific qualification and must not repeat the full history.

### Non-structural relationships

#### `binder_relationships`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `binder_id` | `TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE` |
| `source_record_id` | `TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE` |
| `target_record_id` | `TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE` |
| `kind` | checked canonical kind: `parent`, `sibling`, `spouse`, `rival`, `friend`, `enemy`, or `mentor` |
| `start_date_text`, `start_date_sort` | `TEXT`, `INTEGER` |
| `end_date_text`, `end_date_sort` | `TEXT`, `INTEGER` |
| `notes_json` | versioned rich text |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |

Rules:

- `source_record_id <> target_record_id`.
- Both records must belong to `binder_id`.
- `parent` is stored parent → child and displayed inversely as child.
- `mentor` is stored mentor → student and displayed inversely as student.
- Symmetric kinds use canonical ID ordering (`source_record_id < target_record_id`) and one row.
- Unique index on `(binder_id, source_record_id, target_record_id, kind)`.
- Indexes on both source and target.

Initially the UI should allow Mortal↔Mortal relationships and only explicitly supported cross-type relationships. Natural links such as race, residence, organization membership, domain, place hierarchy, holder, and event participation never enter this table.

### Rich text and mentions

Do not build a Binder-only rich-text editor. Reuse Beholden's existing editor and storage conventions where practical, extending the stored representation only enough to carry stable Binder record-ID mentions. If the existing representation cannot safely encode a mention, use a small versioned mention token embedded alongside its existing content rather than replacing the editor wholesale.

The logical mention payload is:

```json
{
  "version": 1,
  "nodes": [
    {
      "type": "paragraph",
      "children": [
        { "type": "text", "text": "Torin met " },
        {
          "type": "mention",
          "target": { "kind": "binderRecord", "id": "record-id" },
          "label": "Brynja"
        }
      ]
    }
  ]
}
```

Requirements:

- Mention identity is `target.id`; `label` is cached display text only.
- Rendering resolves the current name and route from the authorized API response.
- Campaign mentions use `{kind:"campaign", id:"..."}` without creating a duplicate registry row.
- Unknown/deleted targets render as a non-clickable “Deleted record” marker.
- API projection removes or neutralizes mentions to records the viewer cannot access.
- Renaming a record does not rewrite every document.
- A background integrity query and test detect dangling mentions.

Imported Notion HTML/Markdown still requires sanitization. Binder adapts the existing shared editor/storage path and adds stable mention handling; a new editor framework, collaborative editor, or Binder-specific document system is out of scope.

### Deferred advanced media

#### `binder_media`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `binder_id` | `TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE` |
| `storage_name` | `TEXT NOT NULL UNIQUE` |
| `original_name` | `TEXT NOT NULL` |
| `mime_type` | `TEXT NOT NULL` |
| `byte_size` | `INTEGER NOT NULL` |
| `sha256` | `TEXT NOT NULL` |
| `created_by_user_id` | `TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `created_at` | `INTEGER NOT NULL` |

This table and authenticated Binder media pipeline are deferred from the initial implementation. The importer inventories and reports files but does not need to promote them in the core release. When implemented, reuse the existing data directory, Multer limits, signature validation, Sharp processing, and cache-version practices.

### Import identity and audit

#### `binder_import_runs`

`id`, `binder_id` FK cascade, `source` (`notion_zip`), `source_fingerprint`, `status`, `dry_run`, `started_by_user_id` FK set null, `summary_json`, timestamps.

Unique completed import constraint should be enforced by application transaction and an index on `(binder_id, source, source_fingerprint, status)`.

#### `binder_external_ids`

| Column | Definition |
|---|---|
| `id` | `TEXT PRIMARY KEY` |
| `binder_id` | Binder FK cascade |
| `source` | `TEXT NOT NULL` |
| `external_type` | `TEXT NOT NULL` |
| `external_id` | `TEXT NOT NULL` |
| `record_id` | `TEXT REFERENCES binder_records(id) ON DELETE CASCADE` |
| `campaign_id` | `TEXT REFERENCES campaigns(id) ON DELETE CASCADE` |
| `import_run_id` | import run FK cascade |

Checks require exactly one of `record_id` or `campaign_id`. Constraint: `UNIQUE(binder_id, source, external_id)`.

Unsupported data is retained in the generated import report/artifact, not dumped into an unbounded production properties table.

## 4. Entity relationship explanation

The central relationships are:

```text
User ─owns/edits─> Binder ─has─> BinderRecord ─1:1─> typed lore row
                         │               │
                         │               ├─ aliases / mentions / visibility
                         │               ├─ event associations
                         │               └─ non-structural relationships
                         │
                         └─< Campaign (nullable binder_id)

Mortal ─exactly 1─> NPC ─0:1─> Compendium Monster
       └exactly 1─> Player Character ─1─> user_characters
Mortal ─< OrganizationMembership >─ Organization
                       └─0:1─> Position

Continent ─< Country ─< Location ─< POI
                   POI may instead belong directly to Country or another POI

Event ─< EventRecord >─ Mortal/Deity/Organization/Item/Place
Event ─< EventCampaign >─ existing Campaign
```

The registry is warranted because four requirements need stable cross-type identity: mentions, Event associations, non-structural relationships, and Binder-wide search/visibility. It contains no type-specific lore fields. Consequently:

- Mortals and Deities do not become a nullable “person” table.
- Place subtypes retain normal, readable foreign keys.
- APIs can route `/binders/:binderId/records/:recordId` to the correct typed detail.
- cross-type joins retain real foreign keys instead of storing unchecked `entity_type/entity_id` pairs.

Generated pages query:

- the typed row for structured fields;
- aliases;
- explicit structural relationships;
- visible Events through `binder_event_records`;
- allowed non-structural relationships;
- campaign links and media as applicable.

## 5. Authorization and player-sharing model

### Principals

- Administrator: existing global access.
- Binder owner: full lore access, collaborators, transfer, import, and deletion.
- Binder editor/viewer roles are deferred.
- Campaign DM: automatically receives read access when any Campaign they manage is attached to the Binder. This does not grant edit, import, assignment, ownership-transfer, or delete access.
- Campaign player: can read records explicitly shared to a campaign in which they have `campaign_membership`.
- Linked character owner: campaign-player read access plus explicit patch rights on their linked Mortal.

### Server-side access predicates

Add middleware/service helpers:

- `binderOwnerOrAdmin(db)`
- `binderEditorOrOwnerOrAdmin(db)`
- `binderViewerOrEditorOrOwnerOrAdmin(db)`
- `canReadBinderRecord(db, user, recordId)`
- `requireLinkedMortalFieldAccess(db, user, mortalId, field)`

Record read rules:

1. Admin and owner can read the complete DM projection in the initial implementation.
2. `dm` visibility: no player projection.
3. `campaign` visibility: user must have membership in a campaign listed in `binder_record_campaign_visibility`, and that campaign must still be attached to the record’s Binder.
4. `public` visibility: initially any authenticated user who can reach the Binder through an attached campaign. Whether unauthenticated public sharing is desired is a later product decision.

### Response projection

Never fetch a complete row and pass it through to a player DTO. Create separate query/projection functions:

- `getDmMortalDetail(...)`
- `getPlayerMortalDetail(...)`
- equivalent list/detail projections by type.

Player DTOs omit:

- `dm_notes_json`;
- hidden relationships or related records;
- hidden event associations;
- collaborator/ownership metadata;
- import IDs and audit information;
- secret media;
- unshared campaign associations;
- mention target metadata for inaccessible records.

Player queries apply visibility predicates in SQL before rows are materialized. UI hiding is only a presentation layer.

### Linked Mortal editing

Use endpoint-specific patches, patterned after current character field patches:

- `PATCH /api/me/binder-mortals/:mortalId/backstory`
- optionally `PATCH /api/me/binder-mortals/:mortalId/description`

For each request the server joins:

`binder_player_characters → user_characters → campaigns/players/campaign_membership`.

It verifies:

- the character is owned by `req.user.userId`;
- the explicit edit boolean for that field is true;
- the Mortal remains readable through at least one attached campaign;
- the request schema contains only that field;
- rich-text mentions are valid and visible to the player.

DM-only endpoints remain separate. Do not accept a generic `{field, value}` patch from players. Successful changes update the one Mortal row and broadcast only an ID/version invalidation.

### Concurrency

Include `updatedAt` in detail DTOs and require `If-Unmodified-Since`-style request data or an `expectedUpdatedAt` field for rich-text saves. Return `409 Conflict` on stale edits so a DM and player cannot silently overwrite each other.

## 6. API structure

### Binder collection and administration

- `GET /api/binders` — Binders current user can manage/view.
- `POST /api/binders` — create; authenticated DM/admin, new owner is current user.
- `GET /api/binders/:binderId` — DM projection.
- `PATCH /api/binders/:binderId` — explicit Binder fields.
- `DELETE /api/binders/:binderId` — owner/admin, typed confirmation; campaigns detach.
- `GET|POST|PATCH|DELETE /api/binders/:binderId/members...` — owner/admin collaborator management.
- `GET /api/binders/:binderId/bootstrap` — Binder header, type counts, recent records, attached campaigns, and permissions; keep payload bounded.
- `GET /api/binders/:binderId/search?q=&types=&limit=&cursor=` — selected-Binder search.

### Campaign linkage

- `PUT /api/campaigns/:campaignId/binder` with `{binderId|null}`.
- `PATCH /api/campaigns/:campaignId/date` with explicit date fields.
- Existing campaign list/detail DTOs add optional `binderId` and campaign current date fields.

### Typed records

Prefer consistent typed collections over a generic CRUD payload:

- `/api/binders/:binderId/mortals`
- `/api/binders/:binderId/deities`
- `/api/binders/:binderId/races`
- `/api/binders/:binderId/positions`
- `/api/binders/:binderId/organizations`
- `/api/binders/:binderId/domains`
- `/api/binders/:binderId/continents`
- `/api/binders/:binderId/countries`
- `/api/binders/:binderId/locations`
- `/api/binders/:binderId/pois`
- `/api/binders/:binderId/items`
- `/api/binders/:binderId/events`

Each supports paginated/filterable `GET`, typed `POST`, typed detail `GET`, `PATCH`, and `DELETE`. Use PATCH for partial updates and Zod `.strict()` request schemas. Type-specific subresources include:

- explicit Mortal NPC and Player Character subtype resources.
- Organization memberships.
- Deity domains.
- Event record/campaign associations.
- record visibility campaigns.
- relationships.
- aliases and media.

`GET /api/binders/:binderId/records/:recordId` is read-only routing/mention resolution, not a generic mutation endpoint.

### Player API

- `GET /api/me/campaigns/:campaignId/binder` — safe Binder summary for that campaign.
- `GET /api/me/campaigns/:campaignId/binder/search` — only visible records.
- `GET /api/me/campaigns/:campaignId/binder/records/:recordId` — player-safe generated page.
- linked Mortal field patches described above.

Campaign ID is present in player read routes so authorization is explicit and the server can apply campaign-specific visibility. A player must not gain access by passing only a Binder ID.

### Lists, detail, and payload control

Binder can contain hundreds or thousands of records. Do not include all detail in bootstrap:

- list DTOs: ID, type, name, aliases summary, visibility, one or two display facets, updated time;
- detail DTOs: structured fields, generated relationship sections, and paginated Events;
- cursor pagination by `(name_key,id)` or `(date_sort,id)`;
- ETags or `updatedAt` for detail caching;
- search returns compact results;
- add Binder endpoints to the existing payload budget checks.

### WebSocket events

Add non-secret invalidation events:

- `binders:changed {binderId}`
- `binder:recordChanged {binderId, recordId, recordType, action}`
- `binder:importChanged {binderId, runId, status}`

The event never contains descriptions, DM notes, visibility details, or imported content. Clients refetch through authorized REST routes. Extend WebSocket connection state with authenticated `userId`; validate Binder scope subscription before delivery.

## 7. DM navigation and high-level UX

### Entry and routing

Add a top-level `Binder` navigation item in `web-dm`, next to campaign-level work rather than inside a campaign sidebar.

Suggested routes:

- `/binders`
- `/binders/:binderId`
- `/binders/:binderId/:recordType`
- `/binders/:binderId/:recordType/:recordId`
- `/binders/:binderId/settings`
- `/binders/:binderId/import`

Lazy-load the Binder workspace so existing campaign startup bundles are not materially enlarged.

### Binder selection

The Binder home lists:

- name and description excerpt;
- current setting date;
- attached campaign count;
- record counts;
- last updated time;
- create/import actions according to permission.

Campaign settings gain a nullable Binder selector and campaign current date. Binder settings show attached campaigns and permit detachment but do not duplicate campaign editing.

### Workspace

Recommended high-level shell:

- Left: Binder selector, search, and fixed domain navigation.
- Center: paginated/filterable record list or generated record page.
- Right drawer/panel: create/edit structured fields, visibility, links, and contextual actions.

Navigation labels:

- Campaigns
- People → Mortals, Deities
- Reference → Races, Positions, Organizations, Domains
- Places → Continents, Countries, Locations, Points of Interest
- Items
- Events

Do not add a Notes section. Do not expose arbitrary database/table/property creation.

### Generated pages

Pages are assembled from structured data:

- Mortal: identity, aliases, race, dates, residence, organization/position history, backstory, linked sheet/NPC status, relationships, related Events.
- Organization: description, headquarters, current/historical roster grouped by position, related Events/items/places.
- Place: parent breadcrumb, children, residents/headquarters/items, related Events.
- Event: canonical description, dates, participants grouped by role, campaigns.
- Item: identity, optional mechanics link, current holder/location, related Events.
- Reference records: description plus generated reverse links.

Visibility and player-edit permissions are explicit controls. DM-only content should have unmistakable styling and never share the same response field as player-visible content.

### Search

Phase 1 uses normalized exact/prefix/substring search over record name and aliases within one Binder. SQLite indexes cover exact/prefix paths; cap substring results. If body search is later required and data proves it necessary, add SQLite FTS5 after confirming availability in the deployed `better-sqlite3` build. Do not introduce an external search service.

## 8. Player-facing integration plan

Player work starts after DM records and authorization are stable:

1. Add a Lore/Binder entry to an attached campaign dashboard only when the campaign has visible records.
2. Show campaign-scoped Binder search and generated read-only pages using player DTOs.
3. On a character sheet linked to a Mortal, show a lore/backstory panel sourced from that Mortal.
4. When player editing is later implemented, add explicit field permissions associated with `binder_player_characters`.
5. Add linked, visible items/organizations/places where useful without copying them into the sheet or campaign.

The same Binder rows power both apps. Player routes are campaign-scoped, responses are server-filtered, and hidden mention targets are neutralized. Player editing updates the Mortal and becomes visible to the DM on refetch/WebSocket invalidation.

Mechanical character edits remain on `user_characters`; lore edits remain on `mortals`. The character link connects them without merging their schemas.

## 9. Notion ZIP inspection and import strategy

### Inspected export inventory

The supplied export contains:

- 863 Markdown pages, all non-empty;
- 34 CSV files representing standard and `_all` views of 17 databases;
- one PNG file;
- approximately 3,295 Notion/page-ID reference occurrences in Markdown;
- 720 unique referenced page targets detected;
- 22 unique unresolved target IDs in the raw scan, including database/navigation IDs and a small number of missing pages that need report classification;
- at least 24 duplicate display-title groups, including nine `Untitled` pages and repeated names such as `Kreavale`, `Clover Nation`, `Merchant`, and `Amulet of Health`.

Major `_all.csv` data:

| Notion database | Rows | Proposed target |
|---|---:|---|
| Mortals | 200 | `mortals` plus a mandatory `binder_npcs` row |
| Player Characters | 41 | `mortals` plus a mandatory `binder_player_characters` row |
| Deities (exported as `Dieties`) | 16 | `deities` |
| Races | 23 | `binder_races` |
| Positions | 51 | `binder_positions` |
| Organization | 77 | `binder_organizations`, memberships |
| Domains | 21 | `binder_domains`, `deity_domains` |
| Continents | 9 | `binder_continents` |
| Countries | 44 | `binder_countries` |
| Locations | 205 | `binder_locations` |
| Places of Interest | 13 | `binder_points_of_interest`, initially unplaced unless page content proves a parent |
| Items | 13 | `binder_items` |
| Timeline | 53 | `binder_events` |
| Loot Table | 56 | intentionally ignored relic; report count only |
| Global Variables | 1 | transform `currDate` to Binder current date; do not import a variable table |
| People | 10 | import attribution hints only; never create Beholden users automatically |
| HOME | 1 | unsupported workspace/task data, reported and skipped |

Player Character campaigns found: The Real Drama Club, Dragon Heist, Arrow of Altruism, Frozen Assets, Sterling Sea, Unspoken, Three & a Half-Man, Fellrim Fire, and Teeth of Vecna. These strings require an explicit mapping to existing Beholden campaign IDs; no campaign should be created or matched by name silently.

Important observations:

- Relation values carry Notion URLs with 32-character page IDs.
- Markdown filenames also end with the page ID and use relative links containing it.
- Display names are not unique, so IDs are mandatory.
- The exported Locations CSV stores both Country and Continent; Continent can be validated/derived through Country.
- POI CSV has only a name column. No reliable hierarchy should be invented.
- Mortals calculate Age using `CurrDate`, `DoB`, and the CONST global; store dates, not the calculated age.
- Notion Organizations have a fixed Leader relation; map it to the nullable
  `leader_mortal_id` foreign key by Notion page ID.
- Timeline content is Events; there is no separate Timeline entity.
- Markdown contains mojibake in some text (`â€™`, etc.), so decoding/repair must be detected and reported.
- There are only 12 Markdown image syntaxes and one exported PNG, so media import is practical but sparse.
- Duplicate item page titles occur across Binder Items and Loot Table rows. Database membership and Notion ID determine type.

### Import entry point

Owner/admin-only endpoint:

- `POST /api/binders/:binderId/imports/notion/preview` with a ZIP upload.
- `POST /api/binders/:binderId/imports/notion/commit` using a short-lived preview token/fingerprint and explicit mapping choices.
- `GET /api/binders/:binderId/imports/:runId/report`.

For one-time operational use, the same service can have a CLI wrapper under `server/src/scripts/importNotionBinder.ts`. The parsing/mapping logic must not live only in an HTTP handler.

### ZIP safety and inventory

Before parsing:

- enforce compressed and expanded size limits, file-count limit, and per-file limit;
- reject absolute paths, `..` traversal, symlinks, executables, nested archives, and unsupported encodings;
- stream or stage under a unique directory inside the Beholden data directory;
- hash the original ZIP for idempotency;
- inventory every file with path, type, size, and detected Notion ID;
- pair each database’s regular and `_all` CSV, preferring `_all` and reporting discrepancies;
- never write imported files to their final media location during dry run.

### Identity-first parsing

Pass 1:

1. Parse all filenames and all Notion URLs into normalized lowercase UUID-without-dashes IDs.
2. Identify database page IDs from CSV filenames.
3. Associate CSV rows to Markdown pages by relation IDs and database membership. When the CSV lacks its own row ID, use the unique title only if exactly one unmatched page candidate fits that database; otherwise report ambiguity and require a mapping.
4. Build `externalId → proposed type → proposed Binder ID` in memory.
5. Detect duplicate names without merging them.
6. Record unresolved/missing targets.

No relation or rich-text conversion starts until the identity map is complete.

### Content and relation parsing

Pass 2:

- Parse Markdown heading and property preamble.
- Prefer typed CSV columns for structured values.
- Treat inverse rollup columns (for example Race → Mortals) as validation, not a second source of truth.
- Remove property preambles from narrative body after verifying they match CSV.
- Convert supported Markdown blocks to the Binder rich-text AST.
- Convert relative links ending in a Notion page ID and `notion.so/<id>` links to mention nodes via the identity map.
- Preserve normal external URLs as sanitized links.
- Report unresolved internal links with source page, label, target ID, and line.
- Repair encoding only when a deterministic transformation is safe; otherwise preserve original and report it.

### Mapping details

- `Global Variables.CONST.currDate = 2438` → proposed Binder current date text `2438`, sort `2438`.
- Mortal `DoB`/`DoD` → birth/death date text and parsed sort values.
- Mortal `DoA` → normalized life status.
- Mortal Race/Location → stable target IDs.
- Mortal Position + Organization → one membership row. A Position without Organization cannot become an organization membership and is reported for review or retained as a mention in narrative until mapped.
- Player Character row → Mortal plus a mandatory Player Character subtype row.
  Link an existing `user_character` when explicitly mapped; otherwise import it
  with `character_id = NULL`. Never create a character sheet from lore fields.
- Deity Domains → `deity_domains`.
- Organization Leader → membership role `Leader`, deduplicated against existing inferred membership.
- Country Locations inverse relation → validation. Location Country is authoritative.
- POIs → unplaced POIs unless an unambiguous structured parent is found; current export supplies none.
- Timeline → Events with date text/sort, type migrated to a tag only if event tags are approved; Continent becomes an Event association with role `location`.
- Items database → Binder Items.
- Loot Table → intentionally ignored as a confirmed relic. The report records its file and row count under `ignoredByDecision`; no Loot Table rows become Binder Items or inventory.
- HOME, People, and navigation/system pages → reported unsupported metadata, not lore records.

### Campaign handling

The Notion importer does not create, match, or attach Campaigns. The DM will manually attach existing Beholden Campaigns to the Binder after import. Distinct Notion campaign strings remain in the preview/report for reconciliation but are not authoritative links.

Imported Player Characters still require an explicit existing `user_characters.id` before they can be committed as the mandatory Player Character subtype; campaign-name matching is never used as a substitute.

### Transaction and media behavior

Commit algorithm:

1. Re-hash ZIP and compare to preview.
2. Re-run validation against current database state.
3. Stage/transform media into a unique pending directory.
4. Start one `better-sqlite3` transaction.
5. Insert import run, external IDs, registry rows, typed rows, structural relations, Events, and mentions.
6. Validate counts and foreign-key integrity.
7. Commit database transaction.
8. Atomically promote staged media files.

If database work fails, rollback and remove staged files. If media promotion fails after DB commit, mark the import `media_failed`, keep the staged data for repair, and do not pretend full success. A maintenance command can retry promotion or roll back that import’s rows using `import_run_id`/external mappings.

### Idempotency and duplicate prevention

- ZIP SHA-256 plus Binder ID is the source fingerprint.
- A completed identical import is rejected by default.
- `binder_external_ids` prevents the same Notion page ID being inserted twice.
- A deliberate re-import mode may update rows created by that same external ID, but must preview diffs and never match by display name.
- Imports never merge two records solely because names match.

### Dry-run report

The preview and downloadable JSON report include:

- every database/file and row/page count;
- proposed creates/updates/skips by type;
- external ID mapping;
- duplicate names;
- unresolved and ambiguous row-to-page matches;
- unresolved links and relations;
- unsupported columns/pages/blocks;
- date parse failures and redundant relation conflicts;
- campaign and character mappings still required;
- missing or rejected media;
- encoding repairs;
- exact reasons for every skipped value.

No unsupported information is silently discarded.

## 10. Migration and backward compatibility

### Database migration

1. Create Binder tables and indexes with `IF NOT EXISTS`.
2. Add nullable `binder_id`, `current_date_text`, and `current_date_sort` to `campaigns` using idempotent column checks.
3. Leave all existing rows null and behavior unchanged.
4. Add new response fields as optional; do not change existing DTO meanings.
5. Run `PRAGMA foreign_key_check` after migration in tests and maintenance tooling.
6. Back up the SQLite file before the first Binder migration in production.

No existing campaign is auto-assigned. No Notes are deleted or transformed. No compendium row is migrated.

### API compatibility

- Existing campaign endpoints continue working.
- Binder fields added to campaign DTOs are optional.
- Existing clients ignore new fields.
- New player Binder routes are additive.
- Combatant `base_type` is unchanged in the first Binder release.

When encounter integration ships, prefer adding a new `binder_npc` base type or a source descriptor that snapshots a Mortal plus optional monster mechanics. Existing combatants remain snapshots and are not retroactively linked.

### Export/backup compatibility

Current campaign export must not embed entire Binder lore, because multiple campaigns can share one Binder. Add a separate Binder export format later with:

- format name/version;
- Binder records and links;
- optional media;
- external IDs optionally excluded;
- campaign references represented by IDs/names and remapped on import.

Whole-user/admin backup should include Binder tables and media once Binder ships. Campaign-only export includes `binderId` as an advisory link and remains importable without the Binder.

### Deletion behavior summary

- Delete Binder: explicit owner/admin action; detach campaigns (`SET NULL`), cascade Binder lore/import metadata/media database rows.
- Delete campaign: cascade its existing campaign data and Binder visibility/event/item join rows; Binder lore remains.
- Delete Binder record: cascade its typed row, aliases, event links, relationships, and external mappings; mention documents retain detectable deleted IDs unless a cleanup action is explicitly chosen.
- Delete Character: require or perform an atomic Player Character → NPC conversion so the Mortal remains explicitly typed.
- Delete Mortal: cascade NPC/character link/memberships/event associations; linked character sheet remains.
- Delete compendium monster/item: set Binder mechanics link null.
- Delete referenced race/residence/current holder: set null.
- Delete place parent with children: restrict until reparented.
- Delete owner user: restrict until Binder ownership is transferred.

## 11. Phased implementation plan

### Phase 0 — schema and backend foundation

- Add Binder tables and nullable Campaign assignment/date columns.
- Add owner authorization, record identity helpers, typed validation, and route registration.
- Enforce explicit Mortal subtype transactions and exclusivity.
- Add migration, foreign-key, authorization, and route tests.

Exit: existing databases migrate safely and the backend can create/read/update the core model without secondary systems.

### Phase 1 — complete core Binder and Notion import

- DM navigation and typed CRUD for Mortals, mandatory NPC/Player Character subtypes, Deities, Races, Positions, Organizations/memberships, the four Place types, and Events/associations.
- Basic selected-Binder search over names and aliases without FTS.
- Stable record-ID mentions by extending existing editor/storage conventions.
- ZIP preview, inventory, dry run, report, explicit mappings, transactional commit, and rollback/repair.
- Import the supplied data into a staging database and reconcile every unresolved/unsupported row before production import.

Exit: core generated pages are stable and repeated imports are deterministic with approved counts and relations.

### Phase 2 — deferred sharing and integrations

- Player read sharing and server-side projections.
- Linked player editing and conflict handling.
- Combat/encounter NPC selection.
- Advanced media.
- Binder collaborators.
- Custom calendars.
- Secondary campaign/character/compendium integrations.

### Deferred unless evidence requires them

- unauthenticated public Binder pages;
- FTS5 body search;
- custom calendar definitions and UI;
- Binder collaborators and shared ownership;
- advanced authenticated Binder media;
- pantheon/group schema;
- arbitrary relationship types;
- audit/event sourcing;
- real-time collaborative rich-text editing;
- merging campaign Notes into Binder;
- generic custom properties or user-created record types.

### Pinned follow-up: Game Icons through Iconify

Evaluate a gradual offline migration to `@iconify/react` with
`@iconify-json/game-icons` after the core Binder/import work is stable. Preserve
the semantic `@beholden/shared/icons` component API so DM and player applications
continue to use the same named icons. Bundle only the selected icon data; do not
depend on the public Iconify API at runtime or import the entire collection into
the client bundle. This is a code-maintenance improvement, not a prerequisite for
Binder CRUD or the Notion import.

## 12. Testing strategy

### Database and migration tests

- Fresh database creates every table/index/check.
- Upgrade fixture from the current schema preserves every row and leaves Binder fields null.
- Migration is idempotent across repeated starts.
- `PRAGMA foreign_key_check` is empty.
- Test all cascade, set-null, and restrict behavior.
- Test duplicate-name records remain distinct.
- Test one registry row/typed row transaction invariants.
- Test campaign detachment on Binder deletion.
- Test symmetric relationship canonicalization and inverse labels.
- Test POI cycle/cross-Binder rejection.
- Test signed date ordering and null dates.

### Authorization integration tests

For the initial release, build a matrix for admin, owner, unrelated DM, and unauthenticated request. Extend it with editor, viewer, campaign player, unrelated player, and linked character owner when those deferred roles and player APIs are implemented.

For every list/detail/mutation/media/search endpoint test:

- success cases;
- cross-Binder ID substitution;
- campaign reattachment/detachment;
- visibility changes;
- hidden related Event and mention targets;
- player attempts to patch DM fields or inject extra keys;
- ownership changes and deleted links;
- no data leakage in 403/404 distinctions.

Prefer returning 404 for inaccessible record IDs where existence itself is sensitive.

### API/service tests

- strict Zod schemas and malformed rich text.
- list pagination stability with equal names/dates.
- compact list versus complete detail projections.
- stale `expectedUpdatedAt` conflicts.
- Event-derived timelines and generated rosters.
- search by normalized name and alias.
- mention rename, delete, and hidden-target behavior.
- WebSocket payloads contain identifiers only and authorized scopes receive invalidations.
- payload budget checks include Binder endpoints.

### Import tests

Fixture ZIPs:

- minimal valid export;
- duplicate titles with different IDs;
- relation by ID with renamed label;
- missing targets;
- ambiguous CSV-to-page match;
- malformed CSV/Markdown;
- zip slip, oversized expansion, symlink, nested archive;
- unsupported block and file type;
- mojibake/encoding case;
- media failure;
- duplicate ZIP/import;
- interrupted and rolled-back commit.

Golden-test the supplied export inventory and proposed mapping counts. Test dry run has zero DB/media side effects. Test two previews are deterministic. Import into a temporary database, then assert all links, Event associations, parent hierarchies, and external IDs.

### Frontend tests

- Binder route lazy loading and permission-gated actions.
- list/detail/search states, empty states, pagination, and deleted mention rendering.
- generated page reverse sections.
- visibility controls require explicit campaigns.
- player pages never render DM-only fields because DTOs do not contain them.
- linked player editor sends only the allowed endpoint shape and handles 409 conflicts.
- accessibility for navigation, forms, dialogs, and mention links.

### End-to-end and deployment checks

- DM creates Binder, attaches two campaigns with different dates, and sees both.
- shared NPC appears once across campaign contexts.
- player in one campaign sees only records shared to that campaign.
- linked player changes backstory; DM sees the same row update.
- add linked NPC to an encounter while Monster link is null and while present.
- production builds for server, DM, and player.
- both separate-origin Railway configuration and single-port static serving.
- authenticated Binder media across configured CORS origins.
- database backup/restore and import rollback.

## 13. Risks and mitigations

### Authorization leakage through generated relationships

A visible Mortal can be related to a hidden Event/person. Filtering only the root record is insufficient. Centralize player projection and recursively filter every related record and mention. Test negative cases at SQL/API level.

### Polymorphic integrity

Cross-type links can become unsafe if represented as unchecked type/ID strings. The narrow registry gives real foreign keys. Typed services still validate allowed target types and same-Binder membership.

### Rich-text complexity

Copying arbitrary Notion Markdown/HTML or building a collaborative editor would expand scope rapidly. Reuse the existing editor/storage model, add a narrowly defined stable mention token, sanitize imported content, and preserve unsupported content in import reports.

### Import ambiguity

CSV rows do not always directly expose their own page ID, duplicate titles exist, and some links target missing/navigation pages. Identity-first matching, explicit ambiguity reports, and no name-only merges are mandatory.

### Media secrecy

Existing public static image paths are incompatible with hidden lore. Binder media needs authenticated retrieval and careful caching.

### SQLite query growth

Generated pages can create N+1 queries. Use bounded joined queries/batches and compact projections. Add indexes listed above and inspect `EXPLAIN QUERY PLAN` on search, timelines, visibility, and rosters with an imported-size fixture.

### Migration size and maintainability

Adding all tables to the already-large schema file would be difficult to review. Keep Binder SQL and services modular while using the same database connection and conventions.

### Existing WebSocket scope model

Authenticated sockets currently accept client scope values without membership validation. Binder broadcasts should be identifier-only initially and Binder scope delivery should add authorization, avoiding content exposure.

### Compendium deletion/reference assumptions

SQLite foreign keys to compendium tables require their current key shape to remain stable. Monster/item links should be optional and `SET NULL`; migration tests must cover compendium replacement/import behavior.

### Meaning of “public”

The current product is login-gated. Treat public as broadly shared to authenticated Binder participants until unauthenticated publishing is deliberately designed.

## 14. Resolved product and import decisions

The decisions needed for the core and supplied Notion import are resolved:

1. Any current DM may create and own a Binder. Global administrators retain override access.
2. DMs automatically receive read access to a Binder through an attached Campaign. Only the owner/admin can mutate the Binder in the core release.
3. Campaigns are attached manually in Beholden. The importer does not map or create Campaigns from Notion campaign-name strings.
4. Loot Table is a confirmed relic and is intentionally ignored, with counts recorded in the import report.
5. Plane-like places use the approved hierarchy: a Continent named `Planes`, with Countries such as `Lower Planes` and `Upper Planes`. Individual plane pages are Points of Interest assigned beneath the appropriate Country during import mapping.
6. Exported POIs may import with no parent. They remain fully editable and can later be assigned to a Location, Country, or another POI without re-importing.
7. Notion Event `Type` values import as normalized structured Event tags.

Still deferred and non-blocking: player visibility semantics, linked-player edit fields/workflow, collaborators, unauthenticated publishing, custom calendars, advanced media, pantheons, and other secondary integrations.

## 15. Definition of done for the first production release

The first production release should be considered complete only when:

- existing databases migrate without campaign behavior changes;
- Binder CRUD, typed records, structured mentions, Events, organizations, and place hierarchy work in the DM app;
- server authorization passes the role/visibility matrix;
- Notion dry run accounts for every file, database, row, relation, and unsupported field;
- the approved Notion import completes transactionally and is repeat-safe;
- hidden media and fields cannot be fetched by players;
- existing campaign, character, compendium, combat, export, and Notes tests remain green;
- server, DM, and player production builds deploy in the current structure with no Binder service.
## Follow-on: reversible Campaign and Player archiving

Campaigns and player-owned character sheets now carry `isActive`, stored as SQLite
`is_active INTEGER NOT NULL DEFAULT 1`. Setting it false is a front-page presentation
selection change only: no Campaign, Player, membership, Binder assignment,
character link, encounter, combatant, or lore record is deleted or detached.

- Active records remain in the familiar default screens.
- Inactive records move to an Archived tab and can be reactivated.
- Campaign rosters and assignments are unaffected; an assigned character still
  appears inside its Campaign.
- DM APIs retain both states so archive management remains possible.
