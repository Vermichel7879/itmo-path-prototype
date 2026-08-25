import { sql } from "drizzle-orm";

import "./load-project-environment";
import { createCommandDatabaseConnection } from "../src/lib/db/connection";
import { validateInitialPublishSnapshot } from "../src/lib/db/publish/publish-validation";
import { buildPublicQuestionnaireDTO } from "../src/lib/public-config/questionnaire";
import { calculateCareerTrajectoryDebug } from "../src/lib/rule-engine/engine";
import { machineRegressionFixtures } from "../src/lib/db/config/__fixtures__/machine-regression-cases";
import productionCareerConfig from "../src/lib/db/seed/career-config-v2.json";

let integrationStage = "START";

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
  integrationStage = "CONFIG_METADATA";
  const [metadata] = await connection.db.execute<{ draftCount: number; publishedCount: number; publishedId: string; sourceSha256: string; snapshotSourceSha256: string; snapshotValid: boolean; rulesComplete: boolean }>(sql`
    select
      count(*) filter (where status = 'DRAFT')::int as "draftCount",
      count(*) filter (where status = 'PUBLISHED')::int as "publishedCount",
      max(id::text) filter (where status = 'PUBLISHED') as "publishedId",
      max(source_sha256) filter (where status = 'PUBLISHED') as "sourceSha256",
      max(snapshot -> 'source' ->> 'sha256') filter (where status = 'PUBLISHED') as "snapshotSourceSha256",
      bool_and(
        jsonb_array_length(snapshot -> 'questions') = 10
        and jsonb_array_length(snapshot -> 'answers') = 75
        and jsonb_array_length(snapshot -> 'mappings') = 52
        and jsonb_array_length(snapshot -> 'modules') = 11
        and jsonb_array_length(snapshot -> 'engineRules') = 17
      ) filter (where status = 'PUBLISHED') as "snapshotValid",
      bool_and((select array_agg(item ->> 'stableId' order by item ->> 'stableId') from jsonb_array_elements(snapshot -> 'engineRules') item) = array['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16','R17']) filter (where status = 'PUBLISHED') as "rulesComplete"
    from config_versions
  `);
  if (!metadata || metadata.draftCount !== 1 || metadata.publishedCount !== 1 || !metadata.publishedId) throw new Error("INTEGRATION_CONFIG_COUNTS_FAILED");
  if (!metadata.snapshotValid || !metadata.rulesComplete || metadata.sourceSha256 !== metadata.snapshotSourceSha256) throw new Error("INTEGRATION_PUBLISHED_SNAPSHOT_FAILED");
  const published = { id: metadata.publishedId };

  integrationStage = "SNAPSHOT_VALIDATION";
  const snapshot = validateInitialPublishSnapshot(productionCareerConfig);
  if (snapshot.source.sha256 !== metadata.sourceSha256) throw new Error("INTEGRATION_ARTIFACT_VERSION_MISMATCH");
  integrationStage = "DTO";
  const dto = buildPublicQuestionnaireDTO(published.id, snapshot);
  if (dto.configVersionId !== published.id || dto.questions.length !== 10) throw new Error("INTEGRATION_DTO_FAILED");
  if (/weight|engineRules|modifiers/.test(JSON.stringify(dto))) throw new Error("INTEGRATION_DTO_LEAK");

  integrationStage = "FIXTURES";
  const fixtures = machineRegressionFixtures.filter((fixture) => ["T01", "T20", "T27", "T30", "T31"].includes(fixture.stableId));
  for (const fixture of fixtures) {
    const fixtureSnapshot = structuredClone(snapshot);
    for (const override of fixture.mappingWeightOverrides ?? []) {
      const mapping = fixtureSnapshot.mappings.find((candidate) => candidate.answerStableId === override.answerId && candidate.moduleStableId === override.moduleId);
      if (mapping) mapping.weight = override.weight;
      else {
        const answer = fixtureSnapshot.answers.find((candidate) => candidate.stableId === override.answerId);
        if (!answer) throw new Error(`INTEGRATION_FIXTURE_ANSWER_MISSING ${fixture.stableId}`);
        fixtureSnapshot.mappings.push({ answerStableId: override.answerId, questionStableId: answer.questionStableId, moduleStableId: override.moduleId, weight: override.weight });
      }
    }
    const calculation = calculateCareerTrajectoryDebug(published.id, fixtureSnapshot, fixture.selectedAnswerIds, { rankingScores: fixture.rankingScoresOverride });
    if (calculation.result.primaryModule.id !== fixture.expectedPrimaryModuleId) throw new Error(`INTEGRATION_FIXTURE_PRIMARY_FAILED ${fixture.stableId}`);
    if (JSON.stringify(calculation.result.supportModules.map((module) => module.id)) !== JSON.stringify(fixture.expectedSupportModuleIds)) throw new Error(`INTEGRATION_FIXTURE_SUPPORT_FAILED ${fixture.stableId}`);
  }

  console.log(`DB_INTEGRATION=OK`);
  console.log(`PUBLISHED_ID=${published.id}`);
  console.log(`DB_FIXTURES=${fixtures.length}`);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNKNOWN";
  const message = error instanceof Error && /^INTEGRATION_[A-Z0-9_ ]+$/.test(error.message) ? error.message : "OTHER";
  console.error("DB_INTEGRATION=FAILED");
  console.error(`ERROR_CODE=${code}`);
  console.error(`ERROR_REASON=${message}`);
  console.error(`ERROR_STAGE=${integrationStage}`);
  process.exitCode = 1;
});
