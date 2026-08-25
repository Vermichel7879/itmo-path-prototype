import "./load-project-environment";

import { sql } from "drizzle-orm";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";

const DRAFT_ID = "a8ad8398-48dc-41d7-9793-5e21248be966";
const PUBLISHED_ID = "0699b9e9-790e-4909-b84c-946ee3d70233";

type VerificationRow = {
  draftConfigs: number;
  publishedConfigs: number;
  publishedId: string;
  draftId: string;
  snapshotNonEmpty: boolean;
  snapshotsEqual: boolean;
  snapshotStructureValid: boolean;
  rulesComplete: boolean;
  immutableTriggerExists: boolean;
};

function assertCondition(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`PUBLISHED_VERIFY_FAILED reason=${reason}`);
}

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
    const [result] = await connection.db.execute<VerificationRow>(sql`
      with draft as (
        select id, snapshot from config_versions where status = 'DRAFT'
      ), published as (
        select id, snapshot from config_versions where status = 'PUBLISHED'
      )
      select
        (select count(*)::int from draft) as "draftConfigs",
        (select count(*)::int from published) as "publishedConfigs",
        (select id::text from published) as "publishedId",
        (select id::text from draft) as "draftId",
        coalesce((select snapshot <> '{}'::jsonb from published), false) as "snapshotNonEmpty",
        coalesce((select published.snapshot = draft.snapshot from published, draft), false) as "snapshotsEqual",
        coalesce((select
          jsonb_typeof(snapshot) = 'object'
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
          and not (snapshot ? 'rules') and not (snapshot ? 'examples')
          from published), false) as "snapshotStructureValid",
        coalesce((select
          (select array_agg(item ->> 'stableId' order by item ->> 'stableId')
           from jsonb_array_elements(snapshot -> 'engineRules') item) = array[
             'R01','R02','R03','R04','R05','R06','R07','R08','R09',
             'R10','R11','R12','R13','R14','R15','R16','R17'
           ]
          from published), false) as "rulesComplete",
        exists (
          select 1 from pg_trigger
          where tgname = 'config_versions_published_immutable' and not tgisinternal
        ) as "immutableTriggerExists"
    `);

    assertCondition(result, "NO_RESULT");
    assertCondition(result.draftConfigs === 1, "DRAFT_COUNT");
    assertCondition(result.publishedConfigs === 1, "PUBLISHED_COUNT");
    assertCondition(result.draftId === DRAFT_ID, "DRAFT_ID");
    assertCondition(result.publishedId === PUBLISHED_ID, "PUBLISHED_ID");
    assertCondition(result.snapshotNonEmpty, "EMPTY_SNAPSHOT");
    assertCondition(result.snapshotsEqual, "DRAFT_PUBLISHED_SNAPSHOT_DIFFERENCE");
    assertCondition(result.snapshotStructureValid, "SNAPSHOT_STRUCTURE");
    assertCondition(result.rulesComplete, "RULES_INCOMPLETE");
    assertCondition(result.immutableTriggerExists, "IMMUTABILITY_TRIGGER");

    console.log(`DRAFT_CONFIGS=${result.draftConfigs}`);
    console.log(`PUBLISHED_CONFIGS=${result.publishedConfigs}`);
    console.log(`DRAFT_ID=${result.draftId}`);
    console.log(`PUBLISHED_ID=${result.publishedId}`);
    console.log("PUBLISHED_SNAPSHOT_NON_EMPTY=true");
    console.log("PUBLISHED_SNAPSHOT_EQUALS_VALIDATED_DRAFT=true");
    console.log("PUBLISHED_SNAPSHOT_TYPED_STRUCTURE=OK");
    console.log("PUBLISHED_RULES_R01_R17=OK");
    console.log("PUBLISHED_IMMUTABILITY_TRIGGER=OK");
    console.log("PUBLISHED_VERIFICATION=OK");
  } finally {
    await connection.close();
  }
}

main().catch(() => {
  console.error("PUBLISHED_VERIFICATION=FAILED");
  process.exitCode = 1;
});
