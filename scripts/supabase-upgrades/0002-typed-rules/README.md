# Typed rules schema upgrade 0002

Do not run these files from the local pooler. Use Supabase SQL Editor and run each file once.

1. Open SQL Editor and create a new query.
2. Paste `01-schema.sql`, click **Run**, and expect both `*_exists` values to be `true` and both counts to be `0`.
3. Only after step 2 succeeds, paste `02-drizzle-history.sql` into a new query, click **Run**, and expect `drizzle_migration_records = 3`.
4. Run `verify-schema.sql`; all existence fields must be `true`, migration records must be `3`, and both data counts must still be `0`.
5. Continue with `scripts/supabase-seed-rules/` only after all schema checks pass.

If any file fails, do not run it again and do not run later files. Send the exact Supabase error for diagnosis.
