# V1 to V2 Live Migration

Use this runbook only after taking and verifying a database backup.

1. Export All from **Compendium → Admin** and retain the ZIP beside the database
   backup.
2. Start the updated server once. Startup migrations backfill canonical V2 rows
   idempotently.
3. Convert the authoritative legacy XML with the stateless converter.
4. Preview the resulting Beholden JSON import. Confirm additions and
   replacements before importing.
5. Import the complete bundle. Matching IDs are replaced atomically; validation
   failure writes nothing.
6. Export All again and retain the post-migration ZIP.
7. Verify character creation, one existing character, one level-up, one
   monster, one item, and one spell before reopening normal use.

Do not delete the V1 database or pre-migration ZIP until the post-migration
verification is complete. Legacy API projections remain available during the
rollout, while player class/species/background reads use canonical V2.
