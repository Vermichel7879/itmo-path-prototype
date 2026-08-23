import "./load-project-environment";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { sql } from "drizzle-orm";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";
import { validateCareerImport } from "../src/lib/db/import/import-model";

const EXPECTED_DRAFT_ID = "a8ad8398-48dc-41d7-9793-5e21248be966";

const expectedRuleKinds = {
  R01: "WEIGHTED_SCORING",
  R02: "TIE_BREAK",
  R03: "TIE_BREAK",
  R04: "RESULT_COMPOSITION",
  R05: "SUPPORT_SELECTION",
  R06: "MODIFIER_APPLICATION",
  R07: "RECOMMENDATION_SELECTION",
  R08: "RECOMMENDATION_PREFERENCE",
  R09: "PRIORITY_CAPTURE",
  R10: "PACE_MAPPING",
  R11: "RECOMMENDATION_DEDUPLICATION",
  R12: "CONTENT_POLICY",
  R13: "MODULE_GUARD",
  R14: "MODULE_GUARD",
  R15: "CONDITIONAL_BRANCH",
  R16: "ENTREPRENEUR_COMPOSITION",
  R17: "FALLBACK_SELECTION",
} as const;

const expectedModifierKinds = {
  MOD01: "REPLACE_STEP",
  MOD02: "REPLACE_STEP",
  MOD03: "REPLACE_STEP",
  MOD04: "REPLACE_STEP",
  MOD05: "REPLACE_STEP",
  MOD06: "APPEND_ADJUSTMENT",
  MOD07: "REPLACE_STEP",
  MOD08: "REPLACE_STEP",
  MOD09: "SET_PRIORITIES",
  MOD10: "SET_PACE",
  MOD11: "REPLACE_M11_STAGE",
  MOD12: "APPEND_M11_CHALLENGE",
} as const;

const expectedReplacementSteps = {
  MOD01: 3,
  MOD02: 1,
  MOD03: 3,
  MOD04: 2,
  MOD05: 2,
  MOD07: 1,
  MOD08: 2,
} as const;

type LiveVerificationRow = {
  draftId: string;
  draftConfigs: number;
  publishedConfigs: number;
  questions: number;
  answers: number;
  mappings: number;
  modules: number;
  recommendations: number;
  moduleRecommendations: number;
  modifiers: number;
  entrepreneurStages: number;
  entrepreneurChallenges: number;
  engineRules: number;
  documentationExamples: number;
  migrationRecords: number;
  snapshotStructureValid: boolean;
  rulesMatchSnapshot: boolean;
  modifiersMatchSnapshot: boolean;
  examplesMatchSnapshot: boolean;
  examplesContainSelectedAnswerIds: boolean;
  moduleSortOrderValid: boolean;
  priorityTagsValid: boolean;
};

function assertCondition(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`DATABASE_VERIFICATION_FAILED reason=${reason}`);
}

function safeErrorDetails(error: unknown) {
  const candidates: Record<string, unknown>[] = [];
  let current = error;
  while (typeof current === "object" && current !== null) {
    const object = current as Record<string, unknown>;
    candidates.push(object);
    current = object.cause ?? object.originalError;
  }
  const source =
    [...candidates].reverse().find((candidate) => candidate.code) ??
    candidates.at(-1) ??
    candidates[0];
  let message =
    source && typeof source.message === "string"
      ? source.message
      : "DATABASE_VERIFICATION_FAILED";
  for (const value of [
    process.env.DATABASE_URL,
    process.env.DIRECT_DATABASE_URL,
    process.env.TRANSACTION_DATABASE_URL,
  ]) {
    if (value) message = message.replaceAll(value, "[REDACTED]");
  }
  message = message
    .replace(/\b(?:postgres|postgresql):\/\/\S+/gi, "[REDACTED_URI]")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[REDACTED_URI]")
    .slice(0, 500);
  return {
    name: source?.name ? String(source.name) : "Error",
    code: source?.code ? String(source.code) : "UNKNOWN",
    message,
  };
}

async function main() {
  const expectedSnapshot = validateCareerImport(
    JSON.parse(
      await readFile(resolve("src/lib/db/seed/career-config-v2.json"), "utf8"),
    ),
  );
  const expectedRuleIds = Object.keys(expectedRuleKinds);
  assertCondition(
    expectedSnapshot.engineRules.every(
      (rule) =>
        expectedRuleKinds[rule.stableId as keyof typeof expectedRuleKinds] ===
          rule.ruleKind &&
        rule.sourceTitle.trim().length > 0 &&
        rule.sourceContent.trim().length > 0,
    ),
    "LOCAL_RULE_VALIDATION_FAILED",
  );
  assertCondition(
    expectedSnapshot.modifiers.every((modifier) => {
      if (
        expectedModifierKinds[
          modifier.stableId as keyof typeof expectedModifierKinds
        ] !== modifier.operation.operationKind ||
        modifier.effect.description.trim().length === 0
      ) {
        return false;
      }
      if (modifier.operation.operationKind !== "REPLACE_STEP") return true;
      const expectedStep =
        expectedReplacementSteps[
          modifier.stableId as keyof typeof expectedReplacementSteps
        ];
      return (
        modifier.operation.params.stepNumber === expectedStep &&
        ((modifier.stableId !== "MOD07" && modifier.stableId !== "MOD08") ||
          modifier.operation.params.appliesWhen === "NO_M11_STAGE")
      );
    }),
    "LOCAL_MODIFIER_VALIDATION_FAILED",
  );

  const connection = createCommandDatabaseConnection();
  try {
    const [result] = await connection.db.execute<LiveVerificationRow>(sql`
      with target as (
        select id, snapshot
        from config_versions
        where status = 'DRAFT'
      )
      select
        (select id::text from target limit 1) as "draftId",
        (select count(*)::int from config_versions where status = 'DRAFT') as "draftConfigs",
        (select count(*)::int from config_versions where status = 'PUBLISHED') as "publishedConfigs",
        (select count(*)::int from questions where config_version_id in (select id from target)) as questions,
        (select count(*)::int from answers where config_version_id in (select id from target)) as answers,
        (select count(*)::int from answer_module_weights where config_version_id in (select id from target)) as mappings,
        (select count(*)::int from modules where config_version_id in (select id from target)) as modules,
        (select count(*)::int from recommendations where config_version_id in (select id from target)) as recommendations,
        (select count(*)::int from module_recommendations where config_version_id in (select id from target)) as "moduleRecommendations",
        (select count(*)::int from modifiers where config_version_id in (select id from target)) as modifiers,
        (select count(*)::int from entrepreneur_stages where config_version_id in (select id from target)) as "entrepreneurStages",
        (select count(*)::int from entrepreneur_challenges where config_version_id in (select id from target)) as "entrepreneurChallenges",
        (select count(*)::int from engine_rules where config_version_id in (select id from target)) as "engineRules",
        (select count(*)::int from documentation_examples where config_version_id in (select id from target)) as "documentationExamples",
        (select count(*)::int from drizzle.__drizzle_migrations) as "migrationRecords",
        coalesce((
          select jsonb_typeof(snapshot) = 'object'
            and jsonb_typeof(snapshot -> 'source') = 'object'
            and jsonb_array_length(snapshot -> 'questions') = 10
            and jsonb_array_length(snapshot -> 'answers') = 75
            and jsonb_array_length(snapshot -> 'mappings') = 52
            and jsonb_array_length(snapshot -> 'modules') = 11
            and jsonb_array_length(snapshot -> 'modifiers') = 12
            and jsonb_array_length(snapshot -> 'recommendations') = 22
            and jsonb_array_length(snapshot -> 'moduleRecommendations') = 51
            and jsonb_array_length(snapshot -> 'entrepreneurStages') = 5
            and jsonb_array_length(snapshot -> 'entrepreneurChallenges') = 8
            and jsonb_array_length(snapshot -> 'engineRules') = 17
            and jsonb_array_length(snapshot -> 'documentationExamples') = 7
            and jsonb_array_length(snapshot -> 'editingInstructions') = 10
            and not (snapshot ? 'rules')
            and not (snapshot ? 'examples')
          from target
        ), false) as "snapshotStructureValid",
        coalesce((
          select count(*) = 17
            and count(distinct e.stable_id) = 17
            and array_agg(e.stable_id::text order by e.sort_order) = array[
              'R01','R02','R03','R04','R05','R06','R07','R08','R09',
              'R10','R11','R12','R13','R14','R15','R16','R17'
            ]
            and bool_and(e.rule_kind::text = case e.stable_id
              when 'R01' then 'WEIGHTED_SCORING'
              when 'R02' then 'TIE_BREAK'
              when 'R03' then 'TIE_BREAK'
              when 'R04' then 'RESULT_COMPOSITION'
              when 'R05' then 'SUPPORT_SELECTION'
              when 'R06' then 'MODIFIER_APPLICATION'
              when 'R07' then 'RECOMMENDATION_SELECTION'
              when 'R08' then 'RECOMMENDATION_PREFERENCE'
              when 'R09' then 'PRIORITY_CAPTURE'
              when 'R10' then 'PACE_MAPPING'
              when 'R11' then 'RECOMMENDATION_DEDUPLICATION'
              when 'R12' then 'CONTENT_POLICY'
              when 'R13' then 'MODULE_GUARD'
              when 'R14' then 'MODULE_GUARD'
              when 'R15' then 'CONDITIONAL_BRANCH'
              when 'R16' then 'ENTREPRENEUR_COMPOSITION'
              when 'R17' then 'FALLBACK_SELECTION'
            end)
            and bool_and(length(trim(e.source_title)) > 0 and length(trim(e.source_content)) > 0)
            and bool_and(exists (
              select 1
              from jsonb_array_elements(t.snapshot -> 'engineRules') item
              where item ->> 'stableId' = e.stable_id
                and item ->> 'ruleKind' = e.rule_kind::text
                and item -> 'params' = e.params
                and item ->> 'sourceTitle' = e.source_title
                and item ->> 'sourceContent' = e.source_content
            ))
          from engine_rules e
          inner join target t on t.id = e.config_version_id
        ), false) as "rulesMatchSnapshot",
        coalesce((
          select count(*) = 12
            and count(distinct m.stable_id) = 12
            and array_agg(m.stable_id::text order by m.stable_id) = array[
              'MOD01','MOD02','MOD03','MOD04','MOD05','MOD06',
              'MOD07','MOD08','MOD09','MOD10','MOD11','MOD12'
            ]
            and bool_and(m.operation_kind::text = case m.stable_id
              when 'MOD01' then 'REPLACE_STEP'
              when 'MOD02' then 'REPLACE_STEP'
              when 'MOD03' then 'REPLACE_STEP'
              when 'MOD04' then 'REPLACE_STEP'
              when 'MOD05' then 'REPLACE_STEP'
              when 'MOD06' then 'APPEND_ADJUSTMENT'
              when 'MOD07' then 'REPLACE_STEP'
              when 'MOD08' then 'REPLACE_STEP'
              when 'MOD09' then 'SET_PRIORITIES'
              when 'MOD10' then 'SET_PACE'
              when 'MOD11' then 'REPLACE_M11_STAGE'
              when 'MOD12' then 'APPEND_M11_CHALLENGE'
            end)
            and bool_and(case m.stable_id
              when 'MOD01' then m.operation_params ->> 'stepNumber' = '3'
              when 'MOD02' then m.operation_params ->> 'stepNumber' = '1'
              when 'MOD03' then m.operation_params ->> 'stepNumber' = '3'
              when 'MOD04' then m.operation_params ->> 'stepNumber' = '2'
              when 'MOD05' then m.operation_params ->> 'stepNumber' = '2'
              when 'MOD07' then m.operation_params ->> 'stepNumber' = '1'
                and m.operation_params ->> 'appliesWhen' = 'NO_M11_STAGE'
              when 'MOD08' then m.operation_params ->> 'stepNumber' = '2'
                and m.operation_params ->> 'appliesWhen' = 'NO_M11_STAGE'
              else true
            end)
            and bool_and(
              jsonb_typeof(m.effect) = 'object'
              and length(trim(m.effect ->> 'description')) > 0
            )
            and bool_and(exists (
              select 1
              from jsonb_array_elements(t.snapshot -> 'modifiers') item
              where item ->> 'stableId' = m.stable_id
                and item -> 'effect' = m.effect
                and item -> 'operation' ->> 'operationKind' = m.operation_kind::text
                and item -> 'operation' -> 'params' = m.operation_params
            ))
          from modifiers m
          inner join target t on t.id = m.config_version_id
        ), false) as "modifiersMatchSnapshot",
        coalesce((
          select count(*) = 7
            and count(distinct e.stable_id) = 7
            and array_agg(e.stable_id::text order by e.sort_order) =
              array['E01','E02','E03','E04','E05','E06','E07']
            and bool_and(exists (
              select 1
              from jsonb_array_elements(t.snapshot -> 'documentationExamples') item
              where item ->> 'stableId' = e.stable_id
                and item ->> 'inputSummary' = e.input_summary
                and item ->> 'expectedModuleSummary' = e.expected_module_summary
            ))
          from documentation_examples e
          inner join target t on t.id = e.config_version_id
        ), false) as "examplesMatchSnapshot",
        coalesce((
          select lower((snapshot -> 'documentationExamples')::text)
            like any (array['%selected_answer_ids%', '%selectedanswerids%'])
          from target
        ), false) as "examplesContainSelectedAnswerIds",
        coalesce((
          select count(*) = 11
            and count(distinct sort_order) = 11
            and bool_and(sort_order = substring(stable_id from 2)::int)
          from modules where config_version_id in (select id from target)
        ), false) as "moduleSortOrderValid",
        coalesce((
          select count(*) = 22
            and bool_and(jsonb_typeof(priority_tags) = 'array')
          from recommendations where config_version_id in (select id from target)
        ), false) as "priorityTagsValid"
    `);

    assertCondition(result, "NO_RESULT");
    assertCondition(result.draftId === EXPECTED_DRAFT_ID, "DRAFT_ID_MISMATCH");
    assertCondition(result.draftConfigs === 1, "DRAFT_COUNT_MISMATCH");
    assertCondition(result.publishedConfigs === 0, "PUBLISHED_CONFIG_CREATED");

    const counts = {
      questions: result.questions,
      answers: result.answers,
      mappings: result.mappings,
      modules: result.modules,
      recommendations: result.recommendations,
      moduleRecommendations: result.moduleRecommendations,
      modifiers: result.modifiers,
      entrepreneurStages: result.entrepreneurStages,
      entrepreneurChallenges: result.entrepreneurChallenges,
      engineRules: result.engineRules,
      documentationExamples: result.documentationExamples,
    };
    const expectedCounts = {
      questions: 10,
      answers: 75,
      mappings: 52,
      modules: 11,
      recommendations: 22,
      moduleRecommendations: 51,
      modifiers: 12,
      entrepreneurStages: 5,
      entrepreneurChallenges: 8,
      engineRules: 17,
      documentationExamples: 7,
    };
    assertCondition(
      Object.entries(expectedCounts).every(
        ([key, value]) => counts[key as keyof typeof counts] === value,
      ),
      "ENTITY_COUNT_MISMATCH",
    );
    assertCondition(result.migrationRecords === 3, "MIGRATION_COUNT_MISMATCH");
    assertCondition(result.snapshotStructureValid, "SNAPSHOT_STRUCTURE_MISMATCH");
    assertCondition(result.rulesMatchSnapshot, "RULE_ROWS_MISMATCH");
    assertCondition(result.modifiersMatchSnapshot, "MODIFIER_ROWS_MISMATCH");
    assertCondition(result.examplesMatchSnapshot, "EXAMPLE_ROWS_MISMATCH");
    assertCondition(
      !result.examplesContainSelectedAnswerIds,
      "DOCUMENTATION_EXAMPLES_CONTAIN_SELECTED_ANSWER_IDS",
    );
    assertCondition(result.moduleSortOrderValid, "MODULE_SORT_ORDER_MISMATCH");
    assertCondition(result.priorityTagsValid, "PRIORITY_TAGS_INVALID");

    console.log(`DRAFT_ID=${result.draftId}`);
    console.log(`DRAFT_CONFIGS=${result.draftConfigs}`);
    console.log(`PUBLISHED_CONFIGS=${result.publishedConfigs}`);
    for (const [key, value] of Object.entries(counts)) {
      console.log(
        `${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}=${value}`,
      );
    }
    console.log(`DRIZZLE_MIGRATION_RECORDS=${result.migrationRecords}`);
    console.log(
      `RULE_KIND_MAPPING=${expectedSnapshot.engineRules.map((rule) => `${rule.stableId}:${rule.ruleKind}`).join(",")}`,
    );
    console.log(`RULE_IDS=${expectedRuleIds.join(",")}`);
    console.log("RULE_TYPED_VALIDATION=OK");
    console.log(
      `MODIFIER_OPERATION_MAPPING=${expectedSnapshot.modifiers.map((modifier) => `${modifier.stableId}:${modifier.operation.operationKind}`).join(",")}`,
    );
    console.log("MODIFIER_TARGETS_AND_PRECEDENCE=OK");
    console.log("DOCUMENTATION_EXAMPLES=E01,E02,E03,E04,E05,E06,E07");
    console.log("DOCUMENTATION_EXAMPLES_NON_EXECUTABLE=OK");
    console.log("STORED_SNAPSHOT_TYPED_VALIDATION=OK");
    console.log("SNAPSHOT_TYPED_STRUCTURE=OK");
    console.log("MODULE_SORT_ORDER=M01:1..M11:11");
    console.log("RECOMMENDATION_PRIORITY_TAGS=VALID");
    console.log("DATABASE_VERIFICATION=OK");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  const details = safeErrorDetails(error);
  console.error("DATABASE_VERIFICATION=FAILED");
  console.error(`ERROR_NAME=${details.name}`);
  console.error(`ERROR_CODE=${details.code}`);
  console.error(`ERROR_MESSAGE=${details.message}`);
  process.exitCode = 1;
});
