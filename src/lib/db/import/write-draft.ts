import { randomUUID } from "node:crypto";

import { eq, max } from "drizzle-orm";

import type { CareerDatabase } from "../connection";
import {
  answers,
  answerModuleWeights,
  auditLog,
  configVersions,
  entrepreneurChallenges,
  entrepreneurStages,
  modifiers,
  moduleRecommendations,
  modules,
  questions,
  recommendations,
} from "../schema";
import type { CareerImport } from "./import-model";

export async function replaceDraftFromImport(
  db: CareerDatabase,
  config: CareerImport,
) {
  return db.transaction(async (transaction) => {
    const [existingDraft] = await transaction
      .select({
        id: configVersions.id,
        versionNumber: configVersions.versionNumber,
      })
      .from(configVersions)
      .where(eq(configVersions.status, "DRAFT"))
      .limit(1);
    const [latestVersion] = await transaction
      .select({ value: max(configVersions.versionNumber) })
      .from(configVersions);

    if (existingDraft) {
      await transaction
        .delete(configVersions)
        .where(eq(configVersions.id, existingDraft.id));
    }

    const versionId = randomUUID();
    const versionNumber =
      existingDraft?.versionNumber ?? (latestVersion?.value ?? 0) + 1;
    await transaction.insert(configVersions).values({
      id: versionId,
      versionNumber,
      status: "DRAFT",
      label: `Excel import ${config.source.workbookVersion}`,
      sourceFileName: config.source.fileName,
      sourceSha256: config.source.sha256,
      snapshot: config,
    });

    const questionIds = new Map(
      config.questions.map((question) => [question.stableId, randomUUID()]),
    );
    await transaction.insert(questions).values(
      config.questions.map((question) => ({
        id: questionIds.get(question.stableId)!,
        configVersionId: versionId,
        stableId: question.stableId,
        block: question.block,
        text: question.text,
        selectionType: question.selectionType,
        minSelect: question.minSelect,
        maxSelect: question.maxSelect,
        required: question.required,
        sortOrder: question.sortOrder,
        showCondition: question.showCondition,
        active: question.active,
      })),
    );

    const answerIds = new Map(
      config.answers.map((answer) => [answer.stableId, randomUUID()]),
    );
    await transaction.insert(answers).values(
      config.answers.map((answer) => ({
        id: answerIds.get(answer.stableId)!,
        configVersionId: versionId,
        questionId: questionIds.get(answer.questionStableId)!,
        stableId: answer.stableId,
        text: answer.text,
        sortOrder: answer.sortOrder,
        tags: answer.tags,
        keys: answer.keys,
        active: answer.active,
      })),
    );

    const moduleIds = new Map(
      config.modules.map((module) => [module.stableId, randomUUID()]),
    );
    await transaction.insert(modules).values(
      config.modules.map((module) => ({
        id: moduleIds.get(module.stableId)!,
        configVersionId: versionId,
        stableId: module.stableId,
        name: module.name,
        goal: module.goal,
        step1: module.steps[0],
        step2: module.steps[1],
        step3: module.steps[2],
        checkpoint: module.checkpoint,
        constraints: module.constraints,
        active: module.active,
      })),
    );

    const recommendationIds = new Map(
      config.recommendations.map((recommendation) => [
        recommendation.stableId,
        randomUUID(),
      ]),
    );
    await transaction.insert(recommendations).values(
      config.recommendations.map((recommendation) => ({
        id: recommendationIds.get(recommendation.stableId)!,
        configVersionId: versionId,
        stableId: recommendation.stableId,
        type: recommendation.type,
        title: recommendation.title,
        description: recommendation.description,
        url: recommendation.url,
        status: recommendation.status,
        tags: recommendation.tags,
        active: recommendation.active,
      })),
    );

    await transaction.insert(answerModuleWeights).values(
      config.mappings.map((mapping) => ({
        configVersionId: versionId,
        answerId: answerIds.get(mapping.answerStableId)!,
        moduleId: moduleIds.get(mapping.moduleStableId)!,
        weight: mapping.weight,
      })),
    );

    await transaction.insert(modifiers).values(
      config.modifiers.map((modifier) => ({
        configVersionId: versionId,
        stableId: modifier.stableId,
        triggerAnswerId: modifier.triggerAnswerPattern.includes("*")
          ? null
          : answerIds.get(modifier.triggerAnswerPattern)!,
        triggerAnswerPattern: modifier.triggerAnswerPattern,
        triggerTag: modifier.triggerTag,
        targetScope:
          modifier.targetModuleStableId === "ALL"
            ? ("ALL" as const)
            : ("MODULE" as const),
        targetModuleId:
          modifier.targetModuleStableId === "ALL"
            ? null
            : moduleIds.get(modifier.targetModuleStableId)!,
        type: modifier.type,
        variantKey: modifier.variantKey,
        effect: modifier.effect,
        active: modifier.active,
      })),
    );

    await transaction.insert(moduleRecommendations).values(
      config.moduleRecommendations.map((link) => ({
        configVersionId: versionId,
        moduleId: moduleIds.get(link.moduleStableId)!,
        recommendationId: recommendationIds.get(link.recommendationStableId)!,
        priority: link.priority,
      })),
    );

    await transaction.insert(entrepreneurStages).values(
      config.entrepreneurStages.map((stage) => ({
        configVersionId: versionId,
        stableId: stage.stableId,
        answerId: answerIds.get(stage.answerStableId)!,
        targetModuleId: moduleIds.get(stage.targetModuleStableId)!,
        answerText: stage.answerText,
        focus: stage.focus,
        step1: stage.steps[0],
        step2: stage.steps[1],
        step3: stage.steps[2],
        checkpoint: stage.checkpoint,
        sortOrder: stage.sortOrder,
        active: stage.active,
      })),
    );

    await transaction.insert(entrepreneurChallenges).values(
      config.entrepreneurChallenges.map((challenge) => ({
        configVersionId: versionId,
        stableId: challenge.stableId,
        answerId: answerIds.get(challenge.answerStableId)!,
        targetModuleId: moduleIds.get(challenge.targetModuleStableId)!,
        recommendationId: recommendationIds.get(
          challenge.recommendationStableId,
        )!,
        answerText: challenge.answerText,
        trajectoryAdjustment: challenge.trajectoryAdjustment,
        sortOrder: challenge.sortOrder,
        active: challenge.active,
      })),
    );

    await transaction.insert(auditLog).values({
      configVersionId: versionId,
      action: "IMPORT_DRAFT",
      entityType: "config_version",
      entityId: versionId,
      metadata: {
        sourceFileName: config.source.fileName,
        sourceSha256: config.source.sha256,
        replacedDraftId: existingDraft?.id ?? null,
      },
    });

    return { id: versionId, versionNumber };
  });
}
