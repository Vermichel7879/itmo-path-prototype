import type { CareerImport } from "../db/import/import-model";
import type { EngineRule } from "../db/config/typed-rules";
import type {
  EngineTestOverrides,
  PublicTrajectoryModule,
  PublicTrajectoryRecommendation,
  TrajectoryCalculation,
  TrajectoryPace,
  TrajectoryResult,
} from "./types";

type RuleOfKind<K extends EngineRule["ruleKind"]> = Extract<
  EngineRule,
  { ruleKind: K }
>;

function requireRule<K extends EngineRule["ruleKind"]>(
  config: CareerImport,
  kind: K,
  stableId?: string,
): RuleOfKind<K> {
  const rule = config.engineRules.find(
    (candidate) =>
      candidate.ruleKind === kind && (!stableId || candidate.stableId === stableId),
  );
  if (!rule) throw new Error(`RULE_ENGINE_CONFIG_ERROR missing=${stableId ?? kind}`);
  return rule as RuleOfKind<K>;
}

function selectedAnswers(config: CareerImport, ids: Set<string>) {
  return config.answers.filter((answer) => ids.has(answer.stableId));
}

function conditionMatches(
  condition: { kind: string; answerIds?: string[]; tags?: string[]; tag?: string },
  ids: Set<string>,
  tags: Set<string>,
) {
  if (condition.kind === "ANY_ANSWER_ID") {
    return condition.answerIds?.some((id) => ids.has(id)) ?? false;
  }
  if (condition.kind === "ANY_ANSWER_TAG") {
    return condition.tags?.some((tag) => tags.has(tag)) ?? false;
  }
  if (condition.kind === "ANSWER_TAG_SELECTED") return Boolean(condition.tag && tags.has(condition.tag));
  return false;
}

export function isEntrepreneurBranchActive(
  config: CareerImport,
  selectedAnswerIds: Iterable<string>,
) {
  const ids = new Set(selectedAnswerIds);
  const tags = new Set(
    selectedAnswers(config, ids).flatMap((answer) => answer.tags),
  );
  const branch = requireRule(config, "CONDITIONAL_BRANCH");
  return conditionMatches(branch.params.condition, ids, tags);
}

function triggerMatches(
  pattern: string,
  triggerTag: string | null,
  ids: Set<string>,
  tags: Set<string>,
) {
  if (triggerTag && tags.has(triggerTag)) return true;
  if (pattern.endsWith("_*")) {
    const prefix = pattern.slice(0, -1);
    return [...ids].some((id) => id.startsWith(prefix));
  }
  return ids.has(pattern);
}

function publicModule(module: CareerImport["modules"][number]): PublicTrajectoryModule {
  return {
    id: module.stableId,
    name: module.name,
    goal: module.goal,
    steps: [...module.steps],
    checkpoint: module.checkpoint,
  };
}

function categoryForRecommendation(type: string) {
  if (type === "CKO_SERVICE") return "CKO_SERVICE";
  if (["EVENT", "CLUB", "FACULTY"].includes(type)) return "ECOSYSTEM";
  return "GENERAL";
}

function buildRecommendations(
  config: CareerImport,
  primaryId: string,
  supportIds: string[],
  selectedIds: Set<string>,
  challengeRecommendationIds: string[],
) {
  const selectionRule = requireRule(config, "RECOMMENDATION_SELECTION");
  const preferenceRule = requireRule(config, "RECOMMENDATION_PREFERENCE");
  const priorityRule = requireRule(config, "PRIORITY_CAPTURE");
  const dedupeRule = requireRule(config, "RECOMMENDATION_DEDUPLICATION");
  void dedupeRule;

  const moduleOrder = [primaryId, ...supportIds];
  const recommendationById = new Map(
    config.recommendations.map((recommendation) => [recommendation.stableId, recommendation]),
  );
  const preferenceTargets = new Set<string>();
  const preferenceTypes = new Set<string>();
  for (const answerId of selectedIds) {
    const preference = preferenceRule.params.answerPreferences[answerId];
    if (!preference || preference.defaultMix) continue;
    preference.recommendationIds.forEach((id) => preferenceTargets.add(id));
    preference.recommendationTypes.forEach((type) => preferenceTypes.add(type));
  }
  const priorityTags = new Set(
    config.answers
      .filter(
        (answer) =>
          selectedIds.has(answer.stableId) &&
          answer.questionStableId === priorityRule.params.questionId,
      )
      .flatMap((answer) => answer.keys),
  );

  const candidates = moduleOrder.flatMap((moduleId, sourceRank) =>
    config.moduleRecommendations
      .filter((link) => link.moduleStableId === moduleId)
      .sort((left, right) => left.priority - right.priority)
      .map((link) => ({
        id: link.recommendationStableId,
        sourceRank,
        priority: link.priority,
      })),
  );
  challengeRecommendationIds.forEach((id) =>
    candidates.unshift({ id, sourceRank: -1, priority: 0 }),
  );

  const seen = new Set<string>();
  const eligible = candidates
    .filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      const recommendation = recommendationById.get(candidate.id);
      if (!recommendation || !recommendation.active || recommendation.status !== "ACTIVE") return false;
      if (["EVENT", "CLUB", "FACULTY"].includes(recommendation.type)) return false;
      return true;
    })
    .map((candidate, candidateOrder) => {
      const recommendation = recommendationById.get(candidate.id)!;
      return {
        ...candidate,
        candidateOrder,
        recommendation,
        challengeBoost: challengeRecommendationIds.includes(candidate.id) ? 1 : 0,
        preferenceBoost:
          preferenceTargets.has(candidate.id) || preferenceTypes.has(recommendation.type) ? 1 : 0,
        priorityBoost: recommendation.priorityTags.some((tag) => priorityTags.has(tag)) ? 1 : 0,
      };
    })
    .sort(
      (left, right) =>
        right.challengeBoost - left.challengeBoost ||
        left.sourceRank - right.sourceRank ||
        right.preferenceBoost - left.preferenceBoost ||
        right.priorityBoost - left.priorityBoost ||
        left.priority - right.priority ||
        left.candidateOrder - right.candidateOrder,
    );

  const chosen: typeof eligible = [];
  const usedCategories = new Set<string>();
  for (const candidate of eligible) {
    if (chosen.length >= selectionRule.params.maxRecommendations) break;
    const category = categoryForRecommendation(candidate.recommendation.type);
    const remainingHasNewCategory = eligible.some(
      (other) =>
        !chosen.includes(other) &&
        !usedCategories.has(categoryForRecommendation(other.recommendation.type)),
    );
    if (usedCategories.has(category) && remainingHasNewCategory) continue;
    chosen.push(candidate);
    usedCategories.add(category);
  }
  for (const candidate of eligible) {
    if (chosen.length >= selectionRule.params.maxRecommendations) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }

  return {
    recommendations: chosen.map(
      ({ recommendation }): PublicTrajectoryRecommendation => ({
        id: recommendation.stableId,
        type: recommendation.type,
        title: recommendation.title,
        description: recommendation.description,
        url: recommendation.url,
      }),
    ),
    ranking: eligible.map((candidate) => candidate.id),
  };
}

export function calculateCareerTrajectoryDebug(
  configVersionId: string,
  config: CareerImport,
  selectedAnswerIds: string[],
  overrides: EngineTestOverrides = {},
): TrajectoryCalculation {
  const branchRule = requireRule(config, "CONDITIONAL_BRANCH");
  const selectedIdSet = new Set(selectedAnswerIds);
  const activeBranch = isEntrepreneurBranchActive(config, selectedIdSet);
  const ignoredAnswerIds = config.answers
    .filter(
      (answer) =>
        selectedIdSet.has(answer.stableId) &&
        branchRule.params.questionIds.includes(answer.questionStableId) &&
        !activeBranch,
    )
    .map((answer) => answer.stableId);
  ignoredAnswerIds.forEach((id) => selectedIdSet.delete(id));

  const moduleById = new Map(config.modules.map((module) => [module.stableId, module]));
  const selected = selectedAnswers(config, selectedIdSet);
  const selectedTags = new Set(selected.flatMap((answer) => answer.tags));
  const scoringRule = requireRule(config, "WEIGHTED_SCORING");
  if (
    scoringRule.params.aggregation !== "SUM" ||
    !scoringRule.params.selectedAnswersOnly
  ) {
    throw new Error("RULE_ENGINE_CONFIG_ERROR unsupported_scoring_strategy");
  }
  const scores = Object.fromEntries(config.modules.map((module) => [module.stableId, 0]));
  const questionSubtotals = Object.fromEntries(
    config.modules.map((module) => [module.stableId, {} as Record<string, number>]),
  );
  for (const mapping of config.mappings) {
    if (!selectedIdSet.has(mapping.answerStableId)) continue;
    scores[mapping.moduleStableId] = (scores[mapping.moduleStableId] ?? 0) + mapping.weight;
    const subtotal = questionSubtotals[mapping.moduleStableId];
    subtotal[mapping.questionStableId] =
      (subtotal[mapping.questionStableId] ?? 0) + mapping.weight;
  }
  if (overrides.rankingScores) {
    for (const [moduleId, values] of Object.entries(overrides.rankingScores)) {
      scores[moduleId] = values.total;
      questionSubtotals[moduleId] = {
        Q2: values.Q2,
        Q3: values.Q3,
        Q1: values.Q1,
        Q5: values.Q5,
      };
    }
  }

  const tieBreakRules = config.engineRules
    .filter((rule): rule is RuleOfKind<"TIE_BREAK"> => rule.ruleKind === "TIE_BREAK")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const tieBreakQuestions = tieBreakRules.flatMap((rule) => rule.params.questionIds);
  const guardRules = config.engineRules.filter(
    (rule): rule is RuleOfKind<"MODULE_GUARD"> => rule.ruleKind === "MODULE_GUARD",
  );
  const guardedModules = guardRules
    .filter((rule) => !conditionMatches(rule.params.allowPrimaryWhen, selectedIdSet, selectedTags))
    .map((rule) => rule.params.moduleId);
  const eligibleIds = config.modules
    .filter((module) => module.active && !guardedModules.includes(module.stableId))
    .map((module) => module.stableId);
  const ranking = [...eligibleIds].sort((left, right) => {
    if (scores[right] !== scores[left]) return scores[right] - scores[left];
    for (const questionId of tieBreakQuestions) {
      const difference =
        (questionSubtotals[right][questionId] ?? 0) -
        (questionSubtotals[left][questionId] ?? 0);
      if (difference) return difference;
    }
    return (moduleById.get(left)?.sortOrder ?? 0) - (moduleById.get(right)?.sortOrder ?? 0);
  });

  const supportRule = requireRule(config, "SUPPORT_SELECTION");
  let primaryId = ranking[0];
  let fallbackReason: string | null = null;
  if (!primaryId || (scores[primaryId] ?? 0) < supportRule.params.supportThreshold) {
    const fallback = requireRule(config, "FALLBACK_SELECTION");
    const match = fallback.params.conditions.find((condition) =>
      conditionMatches(condition, selectedIdSet, selectedTags),
    );
    if (!match) throw new Error("RULE_ENGINE_CALCULATION_ERROR no_fallback_match");
    primaryId = match.moduleId;
    fallbackReason = "NO_ELIGIBLE_MODULE_AT_OR_ABOVE_THRESHOLD";
  }
  const primaryBase = moduleById.get(primaryId);
  if (!primaryBase) throw new Error(`RULE_ENGINE_CONFIG_ERROR module=${primaryId}`);
  const maxSupports = requireRule(config, "RESULT_COMPOSITION").params.maxSupportCount;
  const supportIds = ranking
    .filter(
      (moduleId) =>
        moduleId !== primaryId &&
        (scores[moduleId] ?? 0) >= supportRule.params.supportThreshold,
    )
    .slice(0, maxSupports);

  const selectedModuleIds = new Set([primaryId, ...supportIds]);
  const triggeredModifiers = config.modifiers.filter(
    (modifier) =>
      modifier.active &&
      triggerMatches(
        modifier.triggerAnswerPattern,
        modifier.triggerTag,
        selectedIdSet,
        selectedTags,
      ) &&
      (modifier.targetModuleStableId === "ALL" ||
        selectedModuleIds.has(modifier.targetModuleStableId)),
  );
  const steps: [string, string, string] = [...primaryBase.steps];
  let goal = primaryBase.goal;
  let checkpoint = primaryBase.checkpoint;
  const adjustments: string[] = [];
  const appliedModifierIds: string[] = [];
  let pace: TrajectoryPace | null = null;
  let stageResult: { id: string; focus: string } | null = null;
  const challengeAdjustments: string[] = [];
  const challengeRecommendationIds: string[] = [];
  const entrepreneurChallengeIds: string[] = [];
  const entrepreneurRule = requireRule(config, "ENTREPRENEUR_COMPOSITION");

  const pipeline = requireRule(config, "MODIFIER_APPLICATION").params.executionOrder;
  for (const stage of pipeline) {
    if (stage === "BASE_MODIFIERS") {
      const replacements = triggeredModifiers.filter(
        (modifier) =>
          modifier.targetModuleStableId === primaryId &&
          modifier.operation.operationKind === "REPLACE_STEP" &&
          modifier.operation.params.appliesWhen !== "NO_M11_STAGE",
      );
      const targetCounts = new Map<number, number>();
      replacements.forEach((modifier) => {
        const operation = modifier.operation;
        if (operation.operationKind !== "REPLACE_STEP") return;
        targetCounts.set(
          operation.params.stepNumber,
          (targetCounts.get(operation.params.stepNumber) ?? 0) + 1,
        );
      });
      if ([...targetCounts.values()].some((count) => count > 1)) {
        throw new Error("RULE_ENGINE_CALCULATION_ERROR conflicting_step_modifiers");
      }
      replacements.forEach((modifier) => {
        const operation = modifier.operation;
        if (operation.operationKind !== "REPLACE_STEP") return;
        steps[operation.params.stepNumber - 1] = operation.params.replacementText;
        appliedModifierIds.push(modifier.stableId);
      });
      triggeredModifiers.forEach((modifier) => {
        if (modifier.operation.operationKind !== "APPEND_ADJUSTMENT") return;
        adjustments.push(modifier.operation.params.text);
        appliedModifierIds.push(modifier.stableId);
      });
    }
    if (stage === "M11_STAGE" && primaryId === "M11" && activeBranch) {
      const stageAnswerId = selected.find(
        (answer) => answer.questionStableId === entrepreneurRule.params.stageQuestionId,
      )?.stableId;
      const entrepreneurStage = config.entrepreneurStages.find(
        (candidate) => candidate.answerStableId === stageAnswerId && candidate.active,
      );
      if (entrepreneurStage) {
        goal = entrepreneurStage.focus;
        steps.splice(0, entrepreneurRule.params.coreStepCount, ...entrepreneurStage.steps);
        checkpoint = entrepreneurStage.checkpoint;
        stageResult = { id: entrepreneurStage.stableId, focus: entrepreneurStage.focus };
        const stageModifier = triggeredModifiers.find(
          (modifier) => modifier.operation.operationKind === "REPLACE_M11_STAGE",
        );
        if (stageModifier) appliedModifierIds.push(stageModifier.stableId);
      } else {
        triggeredModifiers
          .filter(
            (modifier) =>
              modifier.targetModuleStableId === "M11" &&
              modifier.operation.operationKind === "REPLACE_STEP" &&
              modifier.operation.params.appliesWhen === "NO_M11_STAGE",
          )
          .forEach((modifier) => {
            const operation = modifier.operation;
            if (operation.operationKind !== "REPLACE_STEP") return;
            steps[operation.params.stepNumber - 1] = operation.params.replacementText;
            appliedModifierIds.push(modifier.stableId);
          });
      }
    }
    if (stage === "M11_CHALLENGES" && primaryId === "M11" && activeBranch) {
      const challengeModifier = triggeredModifiers.find(
        (modifier) => modifier.operation.operationKind === "APPEND_M11_CHALLENGE",
      );
      if (challengeModifier?.operation.operationKind === "APPEND_M11_CHALLENGE") {
        const answerSort = new Map(config.answers.map((answer) => [answer.stableId, answer.sortOrder]));
        const challenges = config.entrepreneurChallenges
          .filter((challenge) => selectedIdSet.has(challenge.answerStableId) && challenge.active)
          .sort(
            (left, right) =>
              (answerSort.get(left.answerStableId) ?? 0) -
              (answerSort.get(right.answerStableId) ?? 0),
          )
          .slice(
            0,
            Math.min(
              challengeModifier.operation.params.maxItems,
              entrepreneurRule.params.maxChallenges,
            ),
          );
        challenges.forEach((challenge) => {
          entrepreneurChallengeIds.push(challenge.stableId);
          challengeAdjustments.push(challenge.trajectoryAdjustment);
          adjustments.push(challenge.trajectoryAdjustment);
          challengeRecommendationIds.push(challenge.recommendationStableId);
        });
        if (challenges.length) appliedModifierIds.push(challengeModifier.stableId);
      }
    }
    if (stage === "PRIORITIES") {
      const priorityModifier = triggeredModifiers.find(
        (modifier) => modifier.operation.operationKind === "SET_PRIORITIES",
      );
      if (priorityModifier) appliedModifierIds.push(priorityModifier.stableId);
    }
    if (stage === "PACE") {
      const paceModifier = triggeredModifiers.find(
        (modifier) => modifier.operation.operationKind === "SET_PACE",
      );
      if (paceModifier?.operation.operationKind === "SET_PACE") {
        const paceRule = requireRule(config, "PACE_MAPPING", paceModifier.operation.params.ruleId);
        const selectedPace = paceRule.params.values.find((value) => selectedIdSet.has(value.answerId));
        if (selectedPace) {
          pace = {
            key: selectedPace.key,
            text: selectedPace.text,
            actionsPerWeekMin: selectedPace.actionsPerWeekMin,
            actionsPerWeekMax: selectedPace.actionsPerWeekMax,
            parallelExperimentAllowed: selectedPace.parallelExperimentAllowed,
          };
        }
        appliedModifierIds.push(paceModifier.stableId);
      }
    }
  }

  const priorityRule = requireRule(config, "PRIORITY_CAPTURE");
  const priorities = config.answers
    .filter(
      (answer) =>
        selectedIdSet.has(answer.stableId) &&
        answer.questionStableId === priorityRule.params.questionId,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, priorityRule.params.maxItems)
    .map((answer) => answer.text);
  const recommendationResult = buildRecommendations(
    config,
    primaryId,
    supportIds,
    selectedIdSet,
    challengeRecommendationIds,
  );
  const contentPolicy = requireRule(config, "CONTENT_POLICY");
  if (
    contentPolicy.params.triggerAnswerIds.some((id) => selectedIdSet.has(id)) &&
    selectedModuleIds.has(contentPolicy.params.targetModuleId) &&
    !contentPolicy.params.modifierIds.every((id) => appliedModifierIds.includes(id))
  ) {
    throw new Error("RULE_ENGINE_CALCULATION_ERROR content_policy_modifier_missing");
  }
  const primaryModule: PublicTrajectoryModule = {
    ...publicModule(primaryBase),
    goal,
    steps,
    checkpoint,
  };
  const supportModules = supportIds.map((id) => publicModule(moduleById.get(id)!));
  const result: TrajectoryResult = {
    configVersionId,
    primaryModule,
    supportModules,
    currentPoint: `Сейчас ваш главный фокус — ${goal}`,
    priorities,
    steps,
    adjustments,
    pace,
    recommendations: recommendationResult.recommendations,
    checkpoint,
    disclaimer:
      "Это стартовая траектория, а не карьерная диагностика. Её стоит уточнять после первых действий.",
    entrepreneurship: {
      active: activeBranch,
      stage: stageResult,
      challengeAdjustments,
    },
  };
  return {
    result,
    debug: {
      scores,
      questionSubtotals,
      ranking,
      guardedModules,
      fallbackReason,
      appliedModifierIds: [...new Set(appliedModifierIds)],
      recommendationRanking: recommendationResult.ranking,
      ignoredAnswerIds,
      entrepreneurChallengeIds,
    },
  };
}

export function calculateCareerTrajectory(
  configVersionId: string,
  config: CareerImport,
  selectedAnswerIds: string[],
): TrajectoryResult {
  return calculateCareerTrajectoryDebug(configVersionId, config, selectedAnswerIds).result;
}
