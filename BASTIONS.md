# Bastions

## Data model

Bastions are persisted in SQLite as campaign-linked state (not in XML):

- `bastions`
  - `id`
  - `campaign_id`
  - `name`
  - `active` (0/1)
  - `assigned_player_ids_json`
  - `assigned_character_ids_json`
  - `notes`
  - `maintain_order` (0/1, Bastion-wide)
  - `facilities_json` (player + DM-extra facility assignments with per-facility order)
  - `created_at`, `updated_at`

Compendium-backed Bastion rules are stored separately:

- `compendium_bastion_spaces`
- `compendium_bastion_orders`
- `compendium_bastion_facilities`

## Compendium loading

`server/src/services/compendium/importXml.ts` now detects `Bastions.xml` (`<bastionCompendium>` root) and imports:

- space definitions
- global order list
- basic + special facilities with normalized fields:
  - name/key
  - type
  - minimum level
  - prerequisite
  - valid orders
  - space
  - hirelings (leading numeric value when present)
  - description
  - `allowMultiple` heuristic (`"can have more than one"` in description)

SQLite compendium import also copies Bastion compendium tables when present.

## What is implemented now (Phase 1)

Backend:

- Bastion persistence table + campaign export/import support
- Compendium Bastion parser + normalized storage
- Compendium endpoint: `GET /api/compendium/bastions`
- Campaign Bastion endpoints:
  - `GET /api/campaigns/:campaignId/bastions`
  - `POST /api/campaigns/:campaignId/bastions` (DM/admin)
  - `PUT /api/campaigns/:campaignId/bastions/:bastionId` (DM/admin)
  - `PATCH /api/campaigns/:campaignId/bastions/:bastionId/player` (assigned player/member)
  - `DELETE /api/campaigns/:campaignId/bastions/:bastionId` (DM/admin)
- Validation uses compendium data for legal facilities/orders and level gating
- Special slot progression enforced for player-slot special facilities:
  - level 5: 2
  - level 9: 4
  - level 13: 5
  - level 17: 6
- DM-extra special facilities do not consume player special slots
- `Maintain` modeled as Bastion-wide state (`maintain_order`)

DM app (`web-dm`):

- Bastions tool modal replaces stub
- Campaign-scoped Bastion list
- Grant Bastion flow with multi-player assignment
- Active/inactive toggle
- Facility assignment (player or DM-extra source)
- Player-owned facilities are tracked per assigned player (`ownerPlayerId`)
- Per-facility order assignment from compendium-defined order lists
- Slot usage display
- Hireling totals derived from selected facilities

Player app (`web-player`):

- Campaign page shows `Bastions (x)` beneath party list (assigned + active)
- Bastion sheet route: `/campaigns/:id/bastions/:bastionId`
- Player can add/remove player facilities within legal slot/level constraints
- Player facilities are edited per assigned player identity
- Player can set valid per-facility orders from compendium data
- DM-extra facilities shown separately and do not consume player slots
- Bastion-wide Maintain toggle exposed on sheet

## Intentionally deferred

- Deep prerequisite validation against full character capabilities (currently prerequisite text is displayed and retained; gating is level + compendium-order legality)
- Bastion turn conflict resolution (e.g., enforce Maintain-vs-facility-order exclusivity for a turn lifecycle)
- Rich defender/hireling simulation
- Dedicated UX for multi-owner/shared Bastion workflows beyond assignment lists
- Additional compendium metadata extraction beyond current normalized fields
