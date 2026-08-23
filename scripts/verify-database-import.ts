import "./load-project-environment";

import { sql } from "drizzle-orm";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";

type VerificationRow = {
  draftId: string;
  draftConfigs: number;
  publishedConfigs: number;
  adminUsers: number;
  adminSessions: number;
  projectTables: number;
  migrationRecords: number;
  immutabilityTriggers: number;
  questions: number;
  answers: number;
  mappings: number;
  modules: number;
  recommendations: number;
  moduleRecommendations: number;
  modifiers: number;
  entrepreneurStages: number;
  entrepreneurChallenges: number;
  q1Exists: boolean;
  q2Exists: boolean;
  q10Exists: boolean;
  m01Exists: boolean;
  m02Exists: boolean;
  m11Exists: boolean;
  q9Answers: number;
  q10Answers: number;
  q5A4ToM11Exists: boolean;
  q5A4ToM11Weight: number | null;
  orphanAnswers: number;
  brokenMappings: number;
  duplicateStableIds: number;
};

function assertCondition(condition: unknown, reason: string): asserts condition {
  if (!condition) {
    throw new Error(`DATABASE_VERIFICATION_FAILED reason=${reason}`);
  }
}

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
    const rows = await connection.db.execute<VerificationRow>(sql`
      with target as (
        select id
        from config_versions
        where status = 'DRAFT'
      )
      select
        (select id::text from target limit 1) as "draftId",
        (select count(*)::int from config_versions where status = 'DRAFT') as "draftConfigs",
        (select count(*)::int from config_versions where status = 'PUBLISHED') as "publishedConfigs",
        (select count(*)::int from admin_users) as "adminUsers",
        (select count(*)::int from admin_sessions) as "adminSessions",
        (
          select count(*)::int
          from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'
            and table_name in (
              'admin_users', 'admin_sessions', 'config_versions', 'questions',
              'answers', 'answer_module_weights', 'modules', 'modifiers',
              'recommendations', 'module_recommendations', 'opportunities',
              'entrepreneur_stages', 'entrepreneur_challenges', 'audit_log'
            )
        ) as "projectTables",
        (select count(*)::int from drizzle.__drizzle_migrations) as "migrationRecords",
        (
          select count(*)::int
          from pg_trigger
          where tgname = 'config_versions_published_immutable'
            and not tgisinternal
        ) as "immutabilityTriggers",
        (select count(*)::int from questions where config_version_id in (select id from target)) as questions,
        (select count(*)::int from answers where config_version_id in (select id from target)) as answers,
        (select count(*)::int from answer_module_weights where config_version_id in (select id from target)) as mappings,
        (select count(*)::int from modules where config_version_id in (select id from target)) as modules,
        (select count(*)::int from recommendations where config_version_id in (select id from target)) as recommendations,
        (select count(*)::int from module_recommendations where config_version_id in (select id from target)) as "moduleRecommendations",
        (select count(*)::int from modifiers where config_version_id in (select id from target)) as modifiers,
        (select count(*)::int from entrepreneur_stages where config_version_id in (select id from target)) as "entrepreneurStages",
        (select count(*)::int from entrepreneur_challenges where config_version_id in (select id from target)) as "entrepreneurChallenges",
        exists (select 1 from questions where config_version_id in (select id from target) and stable_id = 'Q1') as "q1Exists",
        exists (select 1 from questions where config_version_id in (select id from target) and stable_id = 'Q2') as "q2Exists",
        exists (select 1 from questions where config_version_id in (select id from target) and stable_id = 'Q10') as "q10Exists",
        exists (select 1 from modules where config_version_id in (select id from target) and stable_id = 'M01') as "m01Exists",
        exists (select 1 from modules where config_version_id in (select id from target) and stable_id = 'M02') as "m02Exists",
        exists (select 1 from modules where config_version_id in (select id from target) and stable_id = 'M11') as "m11Exists",
        (
          select count(*)::int
          from answers a
          inner join questions q
            on q.id = a.question_id
            and q.config_version_id = a.config_version_id
          where a.config_version_id in (select id from target)
            and q.stable_id = 'Q9'
        ) as "q9Answers",
        (
          select count(*)::int
          from answers a
          inner join questions q
            on q.id = a.question_id
            and q.config_version_id = a.config_version_id
          where a.config_version_id in (select id from target)
            and q.stable_id = 'Q10'
        ) as "q10Answers",
        exists (
          select 1
          from answer_module_weights w
          inner join answers a
            on a.id = w.answer_id
            and a.config_version_id = w.config_version_id
          inner join modules m
            on m.id = w.module_id
            and m.config_version_id = w.config_version_id
          where w.config_version_id in (select id from target)
            and a.stable_id = 'Q5_A4'
            and m.stable_id = 'M11'
            and w.weight = 4
        ) as "q5A4ToM11Exists",
        (
          select w.weight
          from answer_module_weights w
          inner join answers a
            on a.id = w.answer_id
            and a.config_version_id = w.config_version_id
          inner join modules m
            on m.id = w.module_id
            and m.config_version_id = w.config_version_id
          where w.config_version_id in (select id from target)
            and a.stable_id = 'Q5_A4'
            and m.stable_id = 'M11'
          limit 1
        ) as "q5A4ToM11Weight",
        (
          select count(*)::int
          from answers a
          left join questions q
            on q.id = a.question_id
            and q.config_version_id = a.config_version_id
          where a.config_version_id in (select id from target)
            and q.id is null
        ) as "orphanAnswers",
        (
          select count(*)::int
          from answer_module_weights w
          left join answers a
            on a.id = w.answer_id
            and a.config_version_id = w.config_version_id
          left join modules m
            on m.id = w.module_id
            and m.config_version_id = w.config_version_id
          where w.config_version_id in (select id from target)
            and (a.id is null or m.id is null)
        ) as "brokenMappings",
        (
          (select count(*) from (
            select stable_id from questions
            where config_version_id in (select id from target)
            group by stable_id having count(*) > 1
          ) duplicates)
          + (select count(*) from (
            select stable_id from answers
            where config_version_id in (select id from target)
            group by stable_id having count(*) > 1
          ) duplicates)
          + (select count(*) from (
            select stable_id from modules
            where config_version_id in (select id from target)
            group by stable_id having count(*) > 1
          ) duplicates)
        )::int as "duplicateStableIds"
    `);

    const result = rows[0];
    assertCondition(result, "NO_RESULT");
    assertCondition(result.draftConfigs === 1, "DRAFT_COUNT_MISMATCH");
    assertCondition(result.publishedConfigs === 0, "PUBLISHED_CONFIG_CREATED");
    assertCondition(result.adminUsers === 0, "ADMIN_USER_CREATED");
    assertCondition(result.adminSessions === 0, "ADMIN_SESSION_CREATED");
    assertCondition(result.projectTables === 14, "PROJECT_TABLE_COUNT_MISMATCH");
    assertCondition(result.migrationRecords === 2, "MIGRATION_COUNT_MISMATCH");
    assertCondition(result.immutabilityTriggers === 1, "IMMUTABILITY_TRIGGER_MISSING");

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
    };
    assertCondition(
      Object.entries(expectedCounts).every(
        ([key, value]) => counts[key as keyof typeof counts] === value,
      ),
      "ENTITY_COUNT_MISMATCH",
    );
    assertCondition(
      result.q1Exists && result.q2Exists && result.q10Exists,
      "QUESTION_RECORD_MISSING",
    );
    assertCondition(
      result.m01Exists && result.m02Exists && result.m11Exists,
      "MODULE_RECORD_MISSING",
    );
    assertCondition(result.q9Answers === 5, "Q9_ANSWER_COUNT_MISMATCH");
    assertCondition(result.q10Answers === 8, "Q10_ANSWER_COUNT_MISMATCH");
    assertCondition(
      result.q5A4ToM11Exists && result.q5A4ToM11Weight === 4,
      "Q5_A4_M11_MAPPING_MISMATCH",
    );
    assertCondition(result.orphanAnswers === 0, "ORPHAN_ANSWER_FOUND");
    assertCondition(result.brokenMappings === 0, "ORPHAN_MAPPING_FOUND");
    assertCondition(result.duplicateStableIds === 0, "DUPLICATE_STABLE_ID_FOUND");

    console.log(`DRAFT_ID=${result.draftId}`);
    console.log(`DRAFT_CONFIGS=${result.draftConfigs}`);
    console.log(`PUBLISHED_CONFIGS=${result.publishedConfigs}`);
    console.log(`ADMIN_USERS=${result.adminUsers}`);
    console.log(`QUESTIONS=${result.questions}`);
    console.log(`ANSWERS=${result.answers}`);
    console.log(`MAPPINGS=${result.mappings}`);
    console.log(`MODULES=${result.modules}`);
    console.log(`RECOMMENDATIONS=${result.recommendations}`);
    console.log(`MODULE_RECOMMENDATIONS=${result.moduleRecommendations}`);
    console.log(`MODIFIERS=${result.modifiers}`);
    console.log(`ENTREPRENEUR_STAGES=${result.entrepreneurStages}`);
    console.log(`ENTREPRENEUR_CHALLENGES=${result.entrepreneurChallenges}`);
    console.log("QUESTIONS_PRESENT=Q1,Q2,Q10");
    console.log("MODULES_PRESENT=M01,M02,M11");
    console.log(`Q9_ANSWERS=${result.q9Answers}`);
    console.log(`Q10_ANSWERS=${result.q10Answers}`);
    console.log(`Q5_A4_TO_M11_WEIGHT=${result.q5A4ToM11Weight}`);
    console.log(`BROKEN_MAPPINGS=${result.brokenMappings}`);
    console.log(`DUPLICATE_STABLE_IDS=${result.duplicateStableIds}`);
    console.log(`DRIZZLE_MIGRATION_RECORDS=${result.migrationRecords}`);
    console.log("DATABASE_VERIFICATION=OK");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "DATABASE_VERIFICATION_FAILED";
  console.error(
    message.startsWith("DATABASE_VERIFICATION_FAILED")
      ? message
      : "DATABASE_VERIFICATION_FAILED reason=QUERY_ERROR",
  );
  process.exitCode = 1;
});
