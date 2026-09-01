# 0012 admin MODULE_GUARD

Run these files once in Supabase SQL Editor, after 0011, in this exact order:

1. `01-module-guard-rpc.sql` — broadens extension rule IDs, creates the atomic DRAFT-only MODULE_GUARD RPC, and upgrades publish validation. Expect all five booleans to be `true`.
2. `02-drizzle-history.sql` — registers migration 0012 only after the first transaction committed. Expect `migration_0012_records = 1`.
3. `verify.sql` — read-only final verification. Expect every boolean to be `true`, one DRAFT, at least one PUBLISHED, and 13 Drizzle migration records.

Do not rerun a failed chunk and do not continue to the next file. Send the complete SQL Editor error for diagnosis. The upgrade does not create a guard and never modifies a PUBLISHED configuration.
