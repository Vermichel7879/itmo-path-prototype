import type { CareerImport } from "@/lib/db/import/import-model";
import type { TrajectoryCalculation } from "@/lib/rule-engine/types";

import type { TrajectoryCompletionPayload } from "./data-api";

export function buildTrajectoryCompletionPayload(
  config: CareerImport,
  selectedAnswerIds: string[],
  calculation: TrajectoryCalculation,
): TrajectoryCompletionPayload {
  const selected = new Set(selectedAnswerIds);
  const ranked = [
    ...calculation.debug.ranking,
    ...config.modules
      .map((module) => module.stableId)
      .filter((id) => !calculation.debug.ranking.includes(id)),
  ];
  return {
    scores: ranked.map((moduleId, index) => ({
      moduleId,
      totalScore: calculation.debug.scores[moduleId] ?? 0,
      finalRank: index + 1,
      q2Score: calculation.debug.questionSubtotals[moduleId]?.Q2 ?? 0,
      q3Score: calculation.debug.questionSubtotals[moduleId]?.Q3 ?? 0,
      q1Score: calculation.debug.questionSubtotals[moduleId]?.Q1 ?? 0,
      q5Score: calculation.debug.questionSubtotals[moduleId]?.Q5 ?? 0,
    })),
    contributions: config.mappings
      .filter((mapping) => selected.has(mapping.answerStableId))
      .map((mapping) => ({
        questionId: mapping.questionStableId,
        answerOptionId: mapping.answerStableId,
        moduleId: mapping.moduleStableId,
        weight: mapping.weight,
      })),
    moduleResults: [
      { moduleId: calculation.result.primaryModule.id, kind: "PRIMARY" as const, position: 1 },
      ...calculation.result.supportModules.map((module, index) => ({
        moduleId: module.id,
        kind: "SUPPORT" as const,
        position: index + 1,
      })),
    ],
    recommendations: calculation.debug.recommendationSelections.map((item, index) => ({
      recommendationId: item.id,
      position: index + 1,
      sourceModuleId: item.sourceModuleId,
    })),
    resultSnapshot: calculation.result,
  };
}
