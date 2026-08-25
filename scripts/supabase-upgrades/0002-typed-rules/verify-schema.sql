SELECT
  to_regclass('public.engine_rules') IS NOT NULL AS engine_rules_exists,
  to_regclass('public.documentation_examples') IS NOT NULL AS documentation_examples_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modifiers'
      AND column_name = 'operation_kind'
  ) AS modifier_operation_kind_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules'
      AND column_name = 'sort_order'
  ) AS module_sort_order_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recommendations'
      AND column_name = 'priority_tags'
  ) AS recommendation_priority_tags_exists,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records,
  (SELECT count(*) FROM engine_rules) AS engine_rules,
  (SELECT count(*) FROM documentation_examples) AS documentation_examples;
