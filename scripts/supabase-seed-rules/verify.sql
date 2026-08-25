WITH target AS (
  SELECT id, snapshot
  FROM config_versions
  WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT'
)
SELECT
  (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*) FROM engine_rules, target WHERE config_version_id = target.id) AS engine_rules,
  (SELECT count(DISTINCT stable_id) FROM engine_rules, target WHERE config_version_id = target.id) AS distinct_rule_ids,
  (SELECT count(*) FROM documentation_examples, target WHERE config_version_id = target.id) AS documentation_examples,
  (SELECT count(*) FROM modifiers, target WHERE config_version_id = target.id AND operation_kind IS NOT NULL AND operation_params IS NOT NULL) AS typed_modifier_operations,
  (SELECT count(*) FROM modules, target WHERE config_version_id = target.id AND sort_order IS NOT NULL) AS modules_with_sort_order,
  jsonb_array_length(target.snapshot -> 'engineRules') AS snapshot_engine_rules,
  jsonb_array_length(target.snapshot -> 'documentationExamples') AS snapshot_documentation_examples,
  NOT (target.snapshot ? 'rules') AS legacy_rules_removed,
  NOT (target.snapshot ? 'examples') AS legacy_examples_removed,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records
FROM target;
