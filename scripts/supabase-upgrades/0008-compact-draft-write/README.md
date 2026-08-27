# 0008 compact DRAFT write

Run these files once in Supabase SQL Editor, in this exact order:

First run `00-preflight.sql` read-only. Expect 8 migration records, `migration_0007_registered = true`, `migration_0008_not_registered = true`, one DRAFT, and one PUBLISHED.

1. `01-compact-draft-rpc.sql` — creates the compact snapshot mutation helper/RPC, grants only the compact RPC to `service_role`, and revokes the legacy large-payload write RPC grants. Expect all three result columns to be `true`.
2. `02-drizzle-history.sql` — registers migration 0008 only after the RPC transaction committed. Expect `migration_0008_records = 1`.
3. `verify.sql` — read-only final verification. Expect every boolean to be `true`, `draft_configs = 1`, `published_configs = 1`, and `drizzle_migration_records = 9`.

Do not run a failed chunk again and do not continue to the next file. Send the complete SQL Editor error for diagnosis. The chunks do not contain credentials and do not modify PUBLISHED data.
