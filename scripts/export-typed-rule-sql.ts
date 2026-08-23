import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateCareerImport } from "../src/lib/db/import/import-model";

const draftId = "a8ad8398-48dc-41d7-9793-5e21248be966";

function text(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function json(value: unknown) {
  return `${text(JSON.stringify(value))}::jsonb`;
}

async function main() {
  const config = validateCareerImport(
    JSON.parse(
      await readFile(resolve("src/lib/db/seed/career-config-v2.json"), "utf8"),
    ),
  );
  const outputDirectory = resolve("scripts/supabase-seed-rules");
  await mkdir(outputDirectory, { recursive: true });

  const engineRuleValues = config.engineRules
    .map(
      (rule) =>
        `  (gen_random_uuid(), '${draftId}'::uuid, ${text(rule.stableId)}, ${text(rule.ruleKind)}::engine_rule_kind, ${json(rule.params)}, ${text(rule.sourceTitle)}, ${text(rule.sourceContent)}, ${rule.sortOrder}, ${rule.active ? "TRUE" : "FALSE"})`,
    )
    .join(",\n");
  const moduleSortValues = config.modules
    .map((module) => `    (${text(module.stableId)}, ${module.sortOrder})`)
    .join(",\n");
  const engineRulesSql = `-- Typed engine rules and deterministic module ordering. Run once.\nBEGIN;\n\nDO $$\nBEGIN\n  IF to_regclass('public.engine_rules') IS NULL THEN\n    RAISE EXCEPTION 'Run typed-rules schema upgrade first';\n  END IF;\n  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 3 THEN\n    RAISE EXCEPTION 'Expected three Drizzle migration records';\n  END IF;\n  IF NOT EXISTS (SELECT 1 FROM config_versions WHERE id = '${draftId}'::uuid AND status = 'DRAFT')\n     OR (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') <> 0 THEN\n    RAISE EXCEPTION 'Unexpected config version state';\n  END IF;\n  IF EXISTS (SELECT 1 FROM engine_rules WHERE config_version_id = '${draftId}'::uuid) THEN\n    RAISE EXCEPTION 'Engine rules already exist for DRAFT';\n  END IF;\n  IF (SELECT count(*) FROM modules WHERE config_version_id = '${draftId}'::uuid) <> 11\n     OR EXISTS (SELECT 1 FROM modules WHERE config_version_id = '${draftId}'::uuid AND sort_order IS NOT NULL) THEN\n    RAISE EXCEPTION 'Expected 11 modules with empty sort_order';\n  END IF;\nEND;\n$$;\n\nINSERT INTO engine_rules (\n  id, config_version_id, stable_id, rule_kind, params, source_title,\n  source_content, sort_order, active\n) VALUES\n${engineRuleValues};\n\nUPDATE modules AS target\nSET sort_order = source.sort_order\nFROM (VALUES\n${moduleSortValues}\n) AS source(stable_id, sort_order)\nWHERE target.config_version_id = '${draftId}'::uuid\n  AND target.stable_id = source.stable_id;\n\nDO $$\nBEGIN\n  IF (SELECT count(*) FROM engine_rules WHERE config_version_id = '${draftId}'::uuid) <> 17\n     OR (SELECT count(DISTINCT stable_id) FROM engine_rules WHERE config_version_id = '${draftId}'::uuid) <> 17\n     OR (SELECT count(*) FROM modules WHERE config_version_id = '${draftId}'::uuid AND sort_order IS NOT NULL) <> 11 THEN\n    RAISE EXCEPTION 'Typed engine rule seed validation failed';\n  END IF;\nEND;\n$$;\n\nCOMMIT;\n\nSELECT\n  (SELECT count(*) FROM engine_rules WHERE config_version_id = '${draftId}'::uuid) AS engine_rules,\n  (SELECT count(*) FROM modules WHERE config_version_id = '${draftId}'::uuid AND sort_order IS NOT NULL) AS modules_with_sort_order;\n`;

  const modifierValues = config.modifiers
    .map(
      (modifier) =>
        `    (${text(modifier.stableId)}, ${text(modifier.operation.operationKind)}::modifier_operation_kind, ${json(modifier.operation.params)})`,
    )
    .join(",\n");
  const modifiersSql = `-- Typed modifier operations. Run once after 01-engine-rules.sql.\nBEGIN;\n\nDO $$\nBEGIN\n  IF (SELECT count(*) FROM modifiers WHERE config_version_id = '${draftId}'::uuid) <> 12 THEN\n    RAISE EXCEPTION 'Expected 12 DRAFT modifiers';\n  END IF;\n  IF EXISTS (\n    SELECT 1 FROM modifiers\n    WHERE config_version_id = '${draftId}'::uuid\n      AND (operation_kind IS NOT NULL OR operation_params IS NOT NULL)\n  ) THEN\n    RAISE EXCEPTION 'Typed modifier operations already exist or seed is partial';\n  END IF;\nEND;\n$$;\n\nUPDATE modifiers AS target\nSET operation_kind = source.operation_kind,\n    operation_params = source.operation_params\nFROM (VALUES\n${modifierValues}\n) AS source(stable_id, operation_kind, operation_params)\nWHERE target.config_version_id = '${draftId}'::uuid\n  AND target.stable_id = source.stable_id;\n\nDO $$\nBEGIN\n  IF (\n    SELECT count(*) FROM modifiers\n    WHERE config_version_id = '${draftId}'::uuid\n      AND operation_kind IS NOT NULL AND operation_params IS NOT NULL\n  ) <> 12 THEN\n    RAISE EXCEPTION 'Typed modifier operation seed validation failed';\n  END IF;\nEND;\n$$;\n\nCOMMIT;\n\nSELECT count(*) AS typed_modifier_operations\nFROM modifiers\nWHERE config_version_id = '${draftId}'::uuid\n  AND operation_kind IS NOT NULL AND operation_params IS NOT NULL;\n`;

  const exampleValues = config.documentationExamples
    .map(
      (example) =>
        `  (gen_random_uuid(), '${draftId}'::uuid, ${text(example.stableId)}, ${text(example.inputSummary)}, ${text(example.expectedModuleSummary)}, ${text(example.primaryFocus)}, ${text(example.stepsSummary)}, ${text(example.recommendationsSummary)}, ${example.sortOrder}, ${example.active ? "TRUE" : "FALSE"})`,
    )
    .join(",\n");
  const examplesSql = `-- Versioned documentation examples E01-E07. Run once.\nBEGIN;\n\nDO $$\nBEGIN\n  IF (SELECT count(*) FROM engine_rules WHERE config_version_id = '${draftId}'::uuid) <> 17 THEN\n    RAISE EXCEPTION 'Engine rules must be seeded first';\n  END IF;\n  IF EXISTS (SELECT 1 FROM documentation_examples WHERE config_version_id = '${draftId}'::uuid) THEN\n    RAISE EXCEPTION 'Documentation examples already exist for DRAFT';\n  END IF;\nEND;\n$$;\n\nINSERT INTO documentation_examples (\n  id, config_version_id, stable_id, input_summary, expected_module_summary,\n  primary_focus, steps_summary, recommendations_summary, sort_order, active\n) VALUES\n${exampleValues};\n\nDO $$\nBEGIN\n  IF (SELECT count(*) FROM documentation_examples WHERE config_version_id = '${draftId}'::uuid) <> 7\n     OR (SELECT count(DISTINCT stable_id) FROM documentation_examples WHERE config_version_id = '${draftId}'::uuid) <> 7 THEN\n    RAISE EXCEPTION 'Documentation example seed validation failed';\n  END IF;\nEND;\n$$;\n\nCOMMIT;\n\nSELECT count(*) AS documentation_examples\nFROM documentation_examples\nWHERE config_version_id = '${draftId}'::uuid;\n`;

  const snapshotSql = `-- Synchronize only the existing DRAFT snapshot after all typed rows exist.\nBEGIN;\n\nDO $$\nDECLARE\n  current_snapshot jsonb;\nBEGIN\n  SELECT snapshot INTO STRICT current_snapshot\n  FROM config_versions\n  WHERE id = '${draftId}'::uuid AND status = 'DRAFT';\n\n  IF (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') <> 0\n     OR (SELECT count(*) FROM engine_rules WHERE config_version_id = '${draftId}'::uuid) <> 17\n     OR (SELECT count(*) FROM documentation_examples WHERE config_version_id = '${draftId}'::uuid) <> 7\n     OR (SELECT count(*) FROM modifiers WHERE config_version_id = '${draftId}'::uuid AND operation_kind IS NOT NULL AND operation_params IS NOT NULL) <> 12\n     OR (SELECT count(*) FROM modules WHERE config_version_id = '${draftId}'::uuid AND sort_order IS NOT NULL) <> 11 THEN\n    RAISE EXCEPTION 'Typed DRAFT prerequisites are incomplete';\n  END IF;\n  IF current_snapshot ? 'engineRules' OR current_snapshot ? 'documentationExamples' THEN\n    RAISE EXCEPTION 'DRAFT snapshot is already typed or partially synchronized';\n  END IF;\nEND;\n$$;\n\nUPDATE config_versions\nSET snapshot = ${json(config)},\n    updated_at = now()\nWHERE id = '${draftId}'::uuid AND status = 'DRAFT';\n\nCOMMIT;\n\nSELECT\n  jsonb_array_length(snapshot -> 'engineRules') AS snapshot_engine_rules,\n  jsonb_array_length(snapshot -> 'documentationExamples') AS snapshot_documentation_examples,\n  NOT (snapshot ? 'rules') AS legacy_rules_removed,\n  NOT (snapshot ? 'examples') AS legacy_examples_removed\nFROM config_versions\nWHERE id = '${draftId}'::uuid AND status = 'DRAFT';\n`;

  const verifySql = `WITH target AS (\n  SELECT id, snapshot\n  FROM config_versions\n  WHERE id = '${draftId}'::uuid AND status = 'DRAFT'\n)\nSELECT\n  (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') AS draft_configs,\n  (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') AS published_configs,\n  (SELECT count(*) FROM engine_rules, target WHERE config_version_id = target.id) AS engine_rules,\n  (SELECT count(DISTINCT stable_id) FROM engine_rules, target WHERE config_version_id = target.id) AS distinct_rule_ids,\n  (SELECT count(*) FROM documentation_examples, target WHERE config_version_id = target.id) AS documentation_examples,\n  (SELECT count(*) FROM modifiers, target WHERE config_version_id = target.id AND operation_kind IS NOT NULL AND operation_params IS NOT NULL) AS typed_modifier_operations,\n  (SELECT count(*) FROM modules, target WHERE config_version_id = target.id AND sort_order IS NOT NULL) AS modules_with_sort_order,\n  jsonb_array_length(target.snapshot -> 'engineRules') AS snapshot_engine_rules,\n  jsonb_array_length(target.snapshot -> 'documentationExamples') AS snapshot_documentation_examples,\n  NOT (target.snapshot ? 'rules') AS legacy_rules_removed,\n  NOT (target.snapshot ? 'examples') AS legacy_examples_removed,\n  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records\nFROM target;\n`;

  const readme = `# Typed rules seed\n\nRun only after the 0002 schema upgrade has been completed and verified. Use Supabase SQL Editor and run every file once in this order:\n\n1. \`01-engine-rules.sql\` -> expect \`engine_rules = 17\`, \`modules_with_sort_order = 11\`.\n2. \`02-modifier-operations.sql\` -> expect \`typed_modifier_operations = 12\`.\n3. \`03-documentation-examples.sql\` -> expect \`documentation_examples = 7\`.\n4. \`04-draft-config-sync.sql\` -> expect snapshot counts \`17\` and \`7\`, with both legacy flags \`true\`.\n5. \`verify.sql\` -> expect DRAFT/PUBLISHED \`1/0\`, rules \`17\`, examples \`7\`, modifiers \`12\`, module sort orders \`11\`, and Drizzle history \`3\`.\n\nEach data file is transactional and intentionally fails if it detects an already-run or partial state. If any file fails, do not rerun it and do not continue. Send the exact Supabase error for diagnosis.\n`;

  await Promise.all([
    writeFile(resolve(outputDirectory, "01-engine-rules.sql"), engineRulesSql),
    writeFile(resolve(outputDirectory, "02-modifier-operations.sql"), modifiersSql),
    writeFile(resolve(outputDirectory, "03-documentation-examples.sql"), examplesSql),
    writeFile(resolve(outputDirectory, "04-draft-config-sync.sql"), snapshotSql),
    writeFile(resolve(outputDirectory, "verify.sql"), verifySql),
    writeFile(resolve(outputDirectory, "README.md"), readme),
  ]);

  console.log(`Typed rule SQL written to ${outputDirectory}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
