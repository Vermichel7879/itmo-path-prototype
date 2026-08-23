# Chunked Supabase bootstrap

Do not run scripts/supabase-bootstrap.sql again. Use only the chunks in this directory.

For every file:

1. Open the Supabase SQL Editor.
2. Create a new query.
3. Paste the entire contents of 01-foundation.sql.
4. Press **Run** once.
5. Check that the returned values match the expectation below.
6. Only when the result is correct, repeat these steps for 02, then 03, 04, 05, and 06.
7. Run verify.sql last.

Expected results:

- 01: expected_objects_found = 3, expected_objects_total = 3, enum_types_found = 8, enum_types_total = 8.
- 02: expected_objects_found = 4, expected_objects_total = 4.
- 03: expected_objects_found = 3, expected_objects_total = 3.
- 04: expected_objects_found = 4, expected_objects_total = 4.
- 05: expected_objects_found = 3, expected_objects_total = 3.
- 06: expected_objects_found = 2, expected_objects_total = 2.
- verify.sql: project_tables_found = 14, all three *_exists values are true, and drizzle_migration_records = 2.

An existing empty drizzle.__drizzle_migrations table is accepted by chunk 06. The chunk stops if either tracked migration record is already present.

If any chunk fails or returns unexpected values, do not run it again and do not run later chunks. Send the complete SQL Editor error for diagnosis.
