import type { CareerImport } from "@/lib/db/import/import-model";
import type { TrajectoryCalculation } from "@/lib/rule-engine/types";

export type AdminPreviewExplanation = ReturnType<typeof buildAdminPreviewExplanation>;

function conditionSummary(condition: { kind: string; answerIds?: string[]; tags?: string[]; tag?: string }) {
  if (condition.kind === "ANY_ANSWER_ID") return `выбран один из ответов: ${(condition.answerIds ?? []).join(", ")}`;
  if (condition.kind === "ANY_ANSWER_TAG") return `выбран один из тегов: ${(condition.tags ?? []).join(", ")}`;
  if (condition.kind === "ANSWER_TAG_SELECTED") return `выбран тег: ${condition.tag ?? "—"}`;
  return condition.kind;
}

function operationSummary(operation: CareerImport["modifiers"][number]["operation"]) {
  if (operation.operationKind === "REPLACE_STEP") return `Шаг ${operation.params.stepNumber} заменён: ${operation.params.replacementText}`;
  if (operation.operationKind === "APPEND_ADJUSTMENT") return `Добавлена корректировка: ${operation.params.text}`;
  if (operation.operationKind === "SET_PRIORITIES") return "Приоритеты результата взяты из выбранных ответов Q6.";
  if (operation.operationKind === "SET_PACE") return `Темп выбран по правилу ${operation.params.ruleId}.`;
  if (operation.operationKind === "REPLACE_M11_STAGE") return "Базовая траектория M11 заменена выбранной стадией Q9.";
  return `Добавлено до ${operation.params.maxItems} корректировок по challenges Q10.`;
}

export function buildAdminPreviewExplanation(
  config: CareerImport,
  calculation: TrajectoryCalculation,
) {
  const { debug, result } = calculation;
  const moduleById = new Map(config.modules.map((item) => [item.stableId, item]));
  const answerById = new Map(config.answers.map((item) => [item.stableId, item]));
  const questionById = new Map(config.questions.map((item) => [item.stableId, item]));
  const recommendationById = new Map(config.recommendations.map((item) => [item.stableId, item]));
  const selected = new Set(debug.selectedAnswerIds);

  const ranking = debug.ranking.map((moduleId, index) => {
    const score = debug.scores[moduleId] ?? 0;
    const role = moduleId === debug.primaryModuleId
      ? "PRIMARY"
      : debug.supportModuleIds.includes(moduleId)
        ? "SUPPORT"
        : "NOT_SELECTED";
    const reason = role === "PRIMARY"
      ? debug.fallbackReason
        ? "Выбран fallback-правилом: обычный ranking не достиг threshold."
        : "Первый доступный модуль в ranking."
      : role === "SUPPORT"
        ? `Score ≥ ${debug.supportThreshold}; вошёл в лимит ${debug.maxSupportCount}.`
        : score < debug.supportThreshold
          ? `Score ниже support threshold ${debug.supportThreshold}.`
          : `Не вошёл в лимит ${debug.maxSupportCount} support-модулей.`;
    return { rank: index + 1, moduleId, name: moduleById.get(moduleId)?.name ?? moduleId, score, role, reason };
  });

  const scoreBreakdown = Object.entries(debug.scores).map(([moduleId, total]) => ({
    moduleId,
    name: moduleById.get(moduleId)?.name ?? moduleId,
    total,
    contributions: debug.scoreContributions
      .filter((item) => item.moduleId === moduleId)
      .map((item) => ({
        ...item,
        answerText: answerById.get(item.answerId)?.text ?? item.answerId,
        questionText: questionById.get(item.questionId)?.text ?? item.questionId,
      })),
  })).filter((item) => item.total !== 0 || item.contributions.length > 0)
    .sort((left, right) => right.total - left.total);

  const tieBreaks: Array<{
    moduleIds: string[];
    total: number;
    steps: Array<{ criterion: string; values: Array<{ moduleId: string; value: number }> }>;
    winnerModuleId: string;
    decidedBy: string;
  }> = [];
  const totalGroups = new Map<number, string[]>();
  debug.ranking.forEach((moduleId) => totalGroups.set(debug.scores[moduleId] ?? 0, [...(totalGroups.get(debug.scores[moduleId] ?? 0) ?? []), moduleId]));
  for (const [total, moduleIds] of totalGroups) {
    if (moduleIds.length < 2) continue;
    const criteria = debug.tieBreakQuestionIds.map((questionId) => ({
      criterion: questionId,
      values: moduleIds.map((moduleId) => ({ moduleId, value: debug.questionSubtotals[moduleId]?.[questionId] ?? 0 })),
    }));
    criteria.push({
      criterion: "sortOrder",
      values: moduleIds.map((moduleId) => ({ moduleId, value: moduleById.get(moduleId)?.sortOrder ?? 0 })),
    });
    const decisive = criteria.find((criterion) => new Set(criterion.values.map((item) => item.value)).size > 1);
    tieBreaks.push({ moduleIds, total, steps: criteria, winnerModuleId: moduleIds[0], decidedBy: decisive?.criterion ?? "Stable ranking order" });
  }

  const guardRules = config.engineRules.filter((rule) => rule.ruleKind === "MODULE_GUARD");
  const guards = guardRules.map((rule) => ({
    ruleId: rule.stableId,
    moduleId: rule.params.moduleId,
    moduleName: moduleById.get(rule.params.moduleId)?.name ?? rule.params.moduleId,
    excluded: debug.guardedModules.includes(rule.params.moduleId),
    condition: conditionSummary(rule.params.allowPrimaryWhen),
  }));

  const fallbackRule = config.engineRules.find((rule) => rule.ruleKind === "FALLBACK_SELECTION");
  const fallbackCondition = fallbackRule && debug.fallbackConditionIndex !== null
    ? fallbackRule.params.conditions[debug.fallbackConditionIndex]
    : null;

  const modifiers = debug.modifierApplications.map((application) => ({
    ...application,
    triggerAnswers: application.triggerAnswerIds.map((id) => ({ id, text: answerById.get(id)?.text ?? id })),
    targetModuleName: application.targetModuleId === "ALL" ? "Все выбранные модули" : moduleById.get(application.targetModuleId)?.name ?? application.targetModuleId,
    change: operationSummary(config.modifiers.find((item) => item.stableId === application.id)!.operation),
  }));

  const priorityRule = config.engineRules.find((rule) => rule.ruleKind === "PRIORITY_CAPTURE");
  const preferenceRule = config.engineRules.find((rule) => rule.ruleKind === "RECOMMENDATION_PREFERENCE");
  const paceRule = config.engineRules.find((rule) => rule.ruleKind === "PACE_MAPPING");
  const priorityAnswers = priorityRule
    ? config.answers.filter((answer) => selected.has(answer.stableId) && answer.questionStableId === priorityRule.params.questionId)
    : [];
  const preferenceAnswers = preferenceRule
    ? config.answers.filter((answer) => selected.has(answer.stableId) && Boolean(preferenceRule.params.answerPreferences[answer.stableId]))
    : [];
  const paceAnswerIds = new Set(paceRule?.params.values.map((value) => value.answerId) ?? []);
  const paceAnswers = config.answers.filter((answer) => selected.has(answer.stableId) && paceAnswerIds.has(answer.stableId));

  const recommendations = debug.recommendationSelections.map((selection) => ({
    ...selection,
    title: result.recommendations.find((item) => item.id === selection.id)?.title ?? recommendationById.get(selection.recommendationId)?.title ?? selection.id,
    moduleName: selection.sourceModuleId ? moduleById.get(selection.sourceModuleId)?.name ?? selection.sourceModuleId : null,
  }));
  const chosenRecommendationIds = new Set(debug.recommendationSelections.map((item) => item.recommendationId));

  return {
    ranking,
    scoreBreakdown,
    tieBreaks,
    supportThreshold: debug.supportThreshold,
    maxSupportCount: debug.maxSupportCount,
    guards,
    fallback: debug.fallbackReason ? {
      reason: debug.fallbackReason,
      selectedModuleId: debug.primaryModuleId,
      selectedModuleName: moduleById.get(debug.primaryModuleId)?.name ?? debug.primaryModuleId,
      condition: fallbackCondition ? conditionSummary(fallbackCondition) : "—",
    } : null,
    modifiers,
    selections: {
      priorities: priorityAnswers.map((answer) => ({ id: answer.stableId, text: answer.text, keys: answer.keys })),
      pace: { answers: paceAnswers.map((answer) => ({ id: answer.stableId, text: answer.text })), result: result.pace },
      preferences: preferenceAnswers.map((answer) => ({ id: answer.stableId, text: answer.text })),
    },
    entrepreneurship: {
      active: debug.entrepreneurBranchActive,
      stage: result.entrepreneurship.stage,
      challengeIds: debug.entrepreneurChallengeIds,
      adjustments: result.entrepreneurship.challengeAdjustments,
      ignoredAnswerIds: debug.ignoredAnswerIds,
    },
    recommendations,
    recommendationExclusions: debug.recommendationRanking
      .filter((id) => !chosenRecommendationIds.has(id))
      .map((id) => ({ id, title: recommendationById.get(id)?.title ?? id, reason: "Не вошла в итоговый лимит или баланс категорий." })),
  };
}
