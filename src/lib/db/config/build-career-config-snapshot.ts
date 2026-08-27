import { asc, eq } from "drizzle-orm";

import type { CareerDatabaseExecutor } from "../connection";
import {
  answers,
  answerModuleWeights,
  configVersions,
  documentationExamples,
  engineRules,
  entrepreneurChallenges,
  entrepreneurStages,
  modifiers,
  moduleRecommendations,
  modules,
  opportunities,
  questions,
  recommendations,
} from "../schema";
import {
  type CareerImport,
  validateCareerImport,
} from "../import/import-model";
import {
  documentationExampleSchema,
  engineRuleSchema,
  modifierOperationSchema,
} from "./typed-rules";
import { readDraftSnapshotChunks } from "./snapshot-reader";

export function assembleCareerConfigSnapshot(input: unknown): CareerImport {
  return validateCareerImport(input);
}

export async function buildCareerConfigSnapshot(
  db: CareerDatabaseExecutor,
  configVersionId: string,
): Promise<CareerImport> {
  const [version] = await db
    .select({
      sourceFileName: configVersions.sourceFileName,
      sourceSha256: configVersions.sourceSha256,
    })
    .from(configVersions)
    .where(eq(configVersions.id, configVersionId))
    .limit(1);
  if (!version) throw new Error(`Config version ${configVersionId} not found`);

  const previousSnapshot = (await readDraftSnapshotChunks(
    db,
    configVersionId,
  )) as Partial<CareerImport> | null;
  if (!previousSnapshot?.source || !previousSnapshot.editingInstructions) {
    throw new Error("Config version is missing source metadata for snapshot build");
  }

  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.configVersionId, configVersionId))
    .orderBy(asc(questions.sortOrder));
  const answerRows = await db
    .select()
    .from(answers)
    .where(eq(answers.configVersionId, configVersionId));
  const moduleRows = await db
    .select()
    .from(modules)
    .where(eq(modules.configVersionId, configVersionId));
  const mappingRows = await db
    .select()
    .from(answerModuleWeights)
    .where(eq(answerModuleWeights.configVersionId, configVersionId));
  const modifierRows = await db
    .select()
    .from(modifiers)
    .where(eq(modifiers.configVersionId, configVersionId));
  const recommendationRows = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.configVersionId, configVersionId));
  const opportunityRows = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.configVersionId, configVersionId));
  const moduleRecommendationRows = await db
    .select()
    .from(moduleRecommendations)
    .where(eq(moduleRecommendations.configVersionId, configVersionId));
  const stageRows = await db
    .select()
    .from(entrepreneurStages)
    .where(eq(entrepreneurStages.configVersionId, configVersionId));
  const challengeRows = await db
    .select()
    .from(entrepreneurChallenges)
    .where(eq(entrepreneurChallenges.configVersionId, configVersionId));
  const ruleRows = await db
    .select()
    .from(engineRules)
    .where(eq(engineRules.configVersionId, configVersionId))
    .orderBy(asc(engineRules.sortOrder));
  const exampleRows = await db
    .select()
    .from(documentationExamples)
    .where(eq(documentationExamples.configVersionId, configVersionId))
    .orderBy(asc(documentationExamples.sortOrder));

  const questionStableIds = new Map(
    questionRows.map((question) => [question.id, question.stableId]),
  );
  const questionSort = new Map(
    questionRows.map((question) => [question.id, question.sortOrder]),
  );
  const answerStableIds = new Map(
    answerRows.map((answer) => [answer.id, answer.stableId]),
  );
  const moduleStableIds = new Map(
    moduleRows.map((module) => [module.id, module.stableId]),
  );
  const recommendationStableIds = new Map(
    recommendationRows.map((recommendation) => [
      recommendation.id,
      recommendation.stableId,
    ]),
  );

  const requiredReference = (
    values: Map<string, string>,
    id: string | null,
    context: string,
  ) => {
    if (!id) throw new Error(`${context} is missing`);
    const stableReference = values.get(id);
    if (!stableReference) throw new Error(`${context} ${id} is broken`);
    return stableReference;
  };

  return assembleCareerConfigSnapshot({
    source: {
      ...previousSnapshot.source,
      fileName: version.sourceFileName ?? previousSnapshot.source.fileName,
      sha256: version.sourceSha256 ?? previousSnapshot.source.sha256,
    },
    questions: questionRows.map((question) => ({
      stableId: question.stableId,
      block: question.block,
      text: question.text,
      selectionType: question.selectionType,
      minSelect: question.minSelect,
      maxSelect: question.maxSelect,
      required: question.required,
      sortOrder: question.sortOrder,
      showCondition: question.showCondition ?? null,
      active: question.active,
      forBachelor: question.forBachelor,
      forMaster: question.forMaster,
    })),
    answers: answerRows
      .sort(
        (left, right) =>
          (questionSort.get(left.questionId) ?? 0) -
            (questionSort.get(right.questionId) ?? 0) ||
          left.sortOrder - right.sortOrder,
      )
      .map((answer) => ({
        stableId: answer.stableId,
        questionStableId: requiredReference(
          questionStableIds,
          answer.questionId,
          "answer question",
        ),
        text: answer.text,
        sortOrder: answer.sortOrder,
        tags: answer.tags,
        keys: answer.keys,
        active: answer.active,
      })),
    mappings: mappingRows.map((mapping) => ({
      answerStableId: requiredReference(
        answerStableIds,
        mapping.answerId,
        "mapping answer",
      ),
      questionStableId: requiredReference(
        questionStableIds,
        answerRows.find((answer) => answer.id === mapping.answerId)?.questionId ?? null,
        "mapping question",
      ),
      moduleStableId: requiredReference(
        moduleStableIds,
        mapping.moduleId,
        "mapping module",
      ),
      weight: mapping.weight,
    })),
    modules: moduleRows
      .sort(
        (left, right) =>
          (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.stableId.localeCompare(right.stableId),
      )
      .map((module) => ({
        stableId: module.stableId,
        name: module.name,
        goal: module.goal,
        steps: [module.step1, module.step2, module.step3],
        checkpoint: module.checkpoint,
        recommendationStableIds: moduleRecommendationRows
          .filter((link) => link.moduleId === module.id)
          .sort((left, right) => left.priority - right.priority)
          .map((link) =>
            requiredReference(
              recommendationStableIds,
              link.recommendationId,
              "module recommendation",
            ),
          ),
        constraints: module.constraints,
        sortOrder: module.sortOrder,
        active: module.active,
        forBachelor: module.forBachelor,
        forMaster: module.forMaster,
      })),
    modifiers: modifierRows.map((modifier) => ({
      stableId: modifier.stableId,
      triggerAnswerPattern: modifier.triggerAnswerPattern,
      triggerTag: modifier.triggerTag,
      targetModuleStableId:
        modifier.targetScope === "ALL"
          ? "ALL"
          : requiredReference(
              moduleStableIds,
              modifier.targetModuleId,
              "modifier module",
            ),
      type: modifier.type,
      variantKey: modifier.variantKey,
      effect: modifier.effect,
      operation: modifierOperationSchema.parse({
        operationKind: modifier.operationKind,
        params: modifier.operationParams,
      }),
      active: modifier.active,
    })),
    recommendations: recommendationRows
      .sort((left, right) => left.stableId.localeCompare(right.stableId))
      .map((recommendation) => ({
        stableId: recommendation.stableId,
        type: recommendation.type,
        title: recommendation.title,
        description: recommendation.description,
        url: recommendation.url,
        status: recommendation.status,
        tags: recommendation.tags,
        priorityTags: recommendation.priorityTags,
        active: recommendation.active,
        forBachelor: recommendation.forBachelor,
        forMaster: recommendation.forMaster,
      })),
    moduleRecommendations: moduleRecommendationRows.map((link) => ({
      moduleStableId: requiredReference(
        moduleStableIds,
        link.moduleId,
        "module recommendation module",
      ),
      recommendationStableId: requiredReference(
        recommendationStableIds,
        link.recommendationId,
        "module recommendation recommendation",
      ),
      priority: link.priority,
    })),
    opportunities: opportunityRows
      .sort((left, right) => left.stableId.localeCompare(right.stableId))
      .map((opportunity) => ({
        stableId: opportunity.stableId,
        type: opportunity.type,
        title: opportunity.title,
        description: opportunity.description,
        url: opportunity.url,
        startsAt: opportunity.startsAt?.toISOString() ?? null,
        endsAt: opportunity.endsAt?.toISOString() ?? null,
        validFrom: opportunity.validFrom?.toISOString() ?? null,
        validTo: opportunity.validTo?.toISOString() ?? null,
        tags: opportunity.tags,
        active: opportunity.active,
      })),
    entrepreneurStages: stageRows
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((stage) => ({
        stableId: stage.stableId,
        answerStableId: requiredReference(
          answerStableIds,
          stage.answerId,
          "entrepreneur stage answer",
        ),
        targetModuleStableId: requiredReference(
          moduleStableIds,
          stage.targetModuleId,
          "entrepreneur stage module",
        ),
        answerText: stage.answerText,
        focus: stage.focus,
        steps: [stage.step1, stage.step2, stage.step3],
        checkpoint: stage.checkpoint,
        sortOrder: stage.sortOrder,
        active: stage.active,
      })),
    entrepreneurChallenges: challengeRows
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((challenge) => ({
        stableId: challenge.stableId,
        answerStableId: requiredReference(
          answerStableIds,
          challenge.answerId,
          "entrepreneur challenge answer",
        ),
        targetModuleStableId: requiredReference(
          moduleStableIds,
          challenge.targetModuleId,
          "entrepreneur challenge module",
        ),
        answerText: challenge.answerText,
        trajectoryAdjustment: challenge.trajectoryAdjustment,
        recommendationStableId: requiredReference(
          recommendationStableIds,
          challenge.recommendationId,
          "entrepreneur challenge recommendation",
        ),
        sortOrder: challenge.sortOrder,
        active: challenge.active,
      })),
    engineRules: ruleRows.map((rule) =>
      engineRuleSchema.parse({
        stableId: rule.stableId,
        ruleKind: rule.ruleKind,
        params: rule.params,
        sourceTitle: rule.sourceTitle,
        sourceContent: rule.sourceContent,
        sortOrder: rule.sortOrder,
        active: rule.active,
      }),
    ),
    documentationExamples: exampleRows.map((example) =>
      documentationExampleSchema.parse({
        stableId: example.stableId,
        inputSummary: example.inputSummary,
        expectedModuleSummary: example.expectedModuleSummary,
        primaryFocus: example.primaryFocus,
        stepsSummary: example.stepsSummary,
        recommendationsSummary: example.recommendationsSummary,
        sortOrder: example.sortOrder,
        active: example.active,
      }),
    ),
    editingInstructions: previousSnapshot.editingInstructions,
  });
}
