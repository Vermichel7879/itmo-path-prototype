# 0010 batch session answer set

Run these files once in Supabase SQL Editor, in this exact order:

1. `01-batch-answer-set-rpc.sql` — creates the atomic full-set RPC and grants EXECUTE only to `service_role`. Expect all four booleans to be `true`.
2. `02-drizzle-history.sql` — registers migration 0010 after the RPC transaction committed. Expect `migration_0010_records = 1`.
3. `verify.sql` — read-only final verification. Expect every boolean to be `true` and `drizzle_migration_records = 11`.

Do not rerun a failed chunk and do not continue to the next file. Send the complete SQL Editor error for diagnosis. The upgrade does not modify existing sessions or answers until the new RPC is explicitly called by the application.
