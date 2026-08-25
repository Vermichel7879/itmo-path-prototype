# Typed rules seed

Run only after the 0002 schema upgrade has been completed and verified. Use Supabase SQL Editor and run every file once in this order:

1. `01-engine-rules.sql` -> expect `engine_rules = 17`, `modules_with_sort_order = 11`.
2. `02-modifier-operations.sql` -> expect `typed_modifier_operations = 12`.
3. `03-documentation-examples.sql` -> expect `documentation_examples = 7`.
4. `04-draft-config-sync.sql` -> expect snapshot counts `17` and `7`, with both legacy flags `true`.
5. `verify.sql` -> expect DRAFT/PUBLISHED `1/0`, rules `17`, examples `7`, modifiers `12`, module sort orders `11`, and Drizzle history `3`.

Each data file is transactional and intentionally fails if it detects an already-run or partial state. If any file fails, do not rerun it and do not continue. Send the exact Supabase error for diagnosis.
