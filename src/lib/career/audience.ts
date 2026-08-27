import type { CareerImport } from "@/lib/db/import/import-model";

export const educationLevelSchemaValues = ["BACHELOR", "MASTER"] as const;
export type EducationLevel = (typeof educationLevelSchemaValues)[number];

type AudienceEntity = { forBachelor: boolean; forMaster: boolean };

export function isForEducationLevel(entity: AudienceEntity, level: EducationLevel) {
  return level === "BACHELOR" ? entity.forBachelor : entity.forMaster;
}

export function filterCareerConfigByAudience(
  config: CareerImport,
  educationLevel: EducationLevel,
): CareerImport {
  const questions = config.questions.filter((item) => isForEducationLevel(item, educationLevel));
  const questionIds = new Set(questions.map((item) => item.stableId));
  const answers = config.answers.filter((item) => questionIds.has(item.questionStableId));
  const answerIds = new Set(answers.map((item) => item.stableId));
  const modules = config.modules.filter((item) => isForEducationLevel(item, educationLevel));
  const moduleIds = new Set(modules.map((item) => item.stableId));
  const recommendations = config.recommendations.filter((item) =>
    isForEducationLevel(item, educationLevel),
  );
  const recommendationIds = new Set(recommendations.map((item) => item.stableId));

  return {
    ...config,
    questions,
    answers,
    modules,
    recommendations,
    mappings: config.mappings.filter(
      (item) => answerIds.has(item.answerStableId) && moduleIds.has(item.moduleStableId),
    ),
    moduleRecommendations: config.moduleRecommendations.filter(
      (item) =>
        moduleIds.has(item.moduleStableId) &&
        recommendationIds.has(item.recommendationStableId),
    ),
    modifiers: config.modifiers.filter(
      (item) =>
        (item.targetModuleStableId === "ALL" || moduleIds.has(item.targetModuleStableId)) &&
        (item.triggerAnswerPattern.endsWith("_*") || answerIds.has(item.triggerAnswerPattern)),
    ),
    entrepreneurStages: config.entrepreneurStages.filter(
      (item) => answerIds.has(item.answerStableId) && moduleIds.has(item.targetModuleStableId),
    ),
    entrepreneurChallenges: config.entrepreneurChallenges.filter(
      (item) =>
        answerIds.has(item.answerStableId) &&
        moduleIds.has(item.targetModuleStableId) &&
        recommendationIds.has(item.recommendationStableId),
    ),
  };
}
