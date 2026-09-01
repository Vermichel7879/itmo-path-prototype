# 0011 admin module create

Run these files once in Supabase SQL Editor, in this exact order:

1. `01-module-create-rpc.sql` — creates the atomic DRAFT-only module creation RPC. Expect all four booleans to be `true`.
2. `02-drizzle-history.sql` — registers migration 0011 after the RPC transaction committed. Expect `migration_0011_records = 1`.
3. `verify.sql` — read-only final verification. Expect every boolean to be `true`, one DRAFT, one PUBLISHED, and 12 Drizzle migration records.

Do not rerun a failed chunk and do not continue to the next file. Send the complete SQL Editor error for diagnosis. The upgrade does not create a module by itself and never modifies PUBLISHED data.

