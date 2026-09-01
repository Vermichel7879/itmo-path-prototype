import { z } from "zod";

const stableId = z.string().trim().min(1);
const nonEmptyText = z.string().trim().min(1);
const questionId = z.string().regex(/^Q\d+$/);
const answerId = z.string().regex(/^Q\d+_A\d+$/);
const moduleId = z.string().regex(/^M\d+$/);
export const moduleGuardScopeValues = ["ALL_RANKING", "PRIMARY_ONLY"] as const;
const modifierId = z.string().regex(/^MOD\d+$/);

export const APPROVED_TYPED_RULE_SOURCE_SHA256 =
  "EFC16A1C08A5019C05962ADD9C6390FB03F9DE9A28AA56FE3495A7F1C76181F2";

export const ruleKindValues = [
  "WEIGHTED_SCORING",
  "TIE_BREAK",
  "RESULT_COMPOSITION",
  "SUPPORT_SELECTION",
  "MODIFIER_APPLICATION",
  "RECOMMENDATION_SELECTION",
  "RECOMMENDATION_PREFERENCE",
  "PRIORITY_CAPTURE",
  "PACE_MAPPING",
  "RECOMMENDATION_DEDUPLICATION",
  "CONTENT_POLICY",
  "MODULE_GUARD",
  "CONDITIONAL_BRANCH",
  "ENTREPRENEUR_COMPOSITION",
  "FALLBACK_SELECTION",
] as const;

export const modifierOperationKindValues = [
  "REPLACE_STEP",
  "APPEND_ADJUSTMENT",
  "SET_PRIORITIES",
  "SET_PACE",
  "REPLACE_M11_STAGE",
  "APPEND_M11_CHALLENGE",
] as const;

const resultAssemblySectionSchema = z
  .object({
    stableId: z.enum([
      "TITLE",
      "CURRENT_POINT",
      "PRIORITIES",
      "PRIMARY_STEPS",
      "SUPPORT_MODULES",
      "RECOMMENDATIONS",
      "PACE",
      "CHECKPOINT",
      "DISCLAIMER",
    ]),
    title: nonEmptyText,
    template: nonEmptyText,
    guidance: nonEmptyText,
    sortOrder: z.number().int().positive(),
  })
  .strict();

const sourceRuleFields = {
  stableId: z.string().regex(/^R(?:0[1-9]|[1-9]\d+)$/),
  sourceTitle: nonEmptyText,
  sourceContent: nonEmptyText,
  sortOrder: z.number().int().min(1),
  active: z.boolean(),
};

const weightedScoringRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("WEIGHTED_SCORING"),
    params: z
      .object({
        aggregation: z.literal("SUM"),
        mappingSource: z.literal("ANSWER_MODULE_WEIGHTS"),
        selectedAnswersOnly: z.literal(true),
      })
      .strict(),
  })
  .strict();

const tieBreakRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("TIE_BREAK"),
    params: z
      .object({
        questionIds: z.array(questionId).min(1),
        questionScoreAggregation: z.literal("SUM_WEIGHTS"),
        finalComparator: z
          .literal("MODULE_SORT_ORDER_ASC")
          .nullable(),
      })
      .strict(),
  })
  .strict();

const resultCompositionRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("RESULT_COMPOSITION"),
    params: z
      .object({
        primaryCount: z.literal(1),
        maxSupportCount: z.number().int().nonnegative(),
        sections: z.array(resultAssemblySectionSchema).length(9),
      })
      .strict(),
  })
  .strict();

const supportSelectionRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("SUPPORT_SELECTION"),
    params: z
      .object({
        supportThreshold: z.number().int(),
        belowThresholdPolicy: z.literal("EXCLUDE"),
        noEligibleSupportPolicy: z.literal("PRIMARY_ONLY"),
        ranking: z.literal("MODULE_RANKING"),
      })
      .strict(),
  })
  .strict();

const modifierApplicationRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("MODIFIER_APPLICATION"),
    params: z
      .object({
        nonScoringQuestionIds: z.array(questionId).min(1),
        executionOrder: z.tuple([
          z.literal("BASE_MODULE"),
          z.literal("BASE_MODIFIERS"),
          z.literal("M11_STAGE"),
          z.literal("M11_CHALLENGES"),
          z.literal("PRIORITIES"),
          z.literal("PACE"),
        ]),
        conflictPolicy: z.literal("ERROR_ON_UNRESOLVED_SAME_TARGET"),
        m11StageOverridesModifierIds: z.array(modifierId),
      })
      .strict(),
  })
  .strict();

const recommendationSelectionRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("RECOMMENDATION_SELECTION"),
    params: z
      .object({
        maxRecommendations: z.number().int().positive(),
        modulePrecedence: z.tuple([
          z.literal("PRIMARY"),
          z.literal("SUPPORT_1"),
          z.literal("SUPPORT_2"),
        ]),
        withinModuleOrder: z.literal("PRIORITY_ASC"),
        diversityMode: z.literal("SOFT"),
        diversityCategories: z.tuple([
          z.object({
            key: z.literal("CKO_SERVICE"),
            recommendationTypes: z.tuple([z.literal("CKO_SERVICE")]),
            requiresConcreteOpportunity: z.literal(false),
          }),
          z.object({
            key: z.literal("ECOSYSTEM"),
            recommendationTypes: z.tuple([
              z.literal("EVENT"),
              z.literal("CLUB"),
              z.literal("FACULTY"),
            ]),
            requiresConcreteOpportunity: z.literal(true),
          }),
          z.object({
            key: z.literal("GENERAL"),
            recommendationTypes: z.tuple([z.literal("GENERAL")]),
            requiresConcreteOpportunity: z.literal(false),
          }),
        ]),
        fillRemainingWithNextEligible: z.literal(true),
        allowFewerThanMaximum: z.literal(true),
        slotWithoutOpportunityPolicy: z.literal("EXCLUDE"),
      })
      .strict(),
  })
  .strict();

const preferenceTargetSchema = z
  .object({
    recommendationIds: z.array(stableId),
    recommendationTypes: z.array(
      z.enum(["CKO_SERVICE", "EVENT", "CLUB", "FACULTY", "GENERAL"]),
    ),
    defaultMix: z.boolean(),
  })
  .strict();

const recommendationPreferenceRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("RECOMMENDATION_PREFERENCE"),
    params: z
      .object({
        questionId,
        selectionOrderPolicy: z.literal("IGNORE_CLICK_ORDER"),
        multiplePreferencePolicy: z.literal("EQUAL_UNION"),
        preferredBucketOrder: z.literal("NORMAL_CANDIDATE_ORDER"),
        answerPreferences: z.record(answerId, preferenceTargetSchema),
      })
      .strict(),
  })
  .strict();

const priorityCaptureRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("PRIORITY_CAPTURE"),
    params: z
      .object({
        questionId,
        resultField: z.literal("priorities"),
        valueSource: z.literal("ANSWER_TEXT"),
        minItems: z.number().int().nonnegative(),
        maxItems: z.number().int().positive(),
        allowedKeys: z.array(nonEmptyText).min(1),
        recommendationTagField: z.literal("priorityTags"),
        recommendationMatching: z.literal("SOFT_PREFERRED_FIRST"),
        untaggedCandidatePolicy: z.literal("KEEP_ELIGIBLE"),
      })
      .strict(),
  })
  .strict();

const paceValueSchema = z
  .object({
    answerId,
    key: z.enum([
      "pace_light",
      "pace_normal",
      "pace_active",
      "pace_intensive",
    ]),
    actionsPerWeekMin: z.number().int().positive().nullable(),
    actionsPerWeekMax: z.number().int().positive().nullable(),
    parallelExperimentAllowed: z.boolean(),
    text: nonEmptyText,
  })
  .strict();

const paceMappingRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("PACE_MAPPING"),
    params: z
      .object({
        questionId,
        values: z.array(paceValueSchema).length(4),
        preservesCoreStepCount: z.literal(3),
        addAutomaticCoreStep: z.literal(false),
      })
      .strict(),
  })
  .strict();

const recommendationDeduplicationRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("RECOMMENDATION_DEDUPLICATION"),
    params: z
      .object({
        scope: z.literal("RESULT"),
        keys: z.tuple([
          z.literal("RECOMMENDATION_ID"),
          z.literal("OPPORTUNITY_ID"),
        ]),
        keep: z.literal("FIRST_BY_CANDIDATE_ORDER"),
      })
      .strict(),
  })
  .strict();

const contentPolicyRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("CONTENT_POLICY"),
    params: z
      .object({
        triggerAnswerIds: z.array(answerId).min(1),
        targetModuleId: moduleId,
        modifierIds: z.array(modifierId).min(1),
        prohibitedClaims: z.array(z.literal("ATS_BYPASS")).min(1),
        requiredFraming: z.tuple([
          z.literal("RELEVANCE"),
          z.literal("READABILITY"),
          z.literal("ADAPTATION"),
          z.literal("CONVERSION"),
        ]),
      })
      .strict(),
  })
  .strict();

const moduleGuardRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("MODULE_GUARD"),
    params: z
      .object({
        moduleId,
        allowPrimaryWhen: z.discriminatedUnion("kind", [
          z
            .object({
              kind: z.literal("ANY_ANSWER_ID"),
              answerIds: z.array(answerId).min(1),
            })
            .strict(),
          z
            .object({
              kind: z.literal("ANY_ANSWER_TAG"),
              tags: z.array(nonEmptyText).min(1),
            })
            .strict(),
        ]),
        blockedPolicy: z.literal("REMOVE_FROM_PRIMARY_CANDIDATES"),
        scope: z.enum(moduleGuardScopeValues).default("ALL_RANKING"),
      })
      .strict(),
  })
  .strict();

const conditionalBranchRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("CONDITIONAL_BRANCH"),
    params: z
      .object({
        condition: z
          .object({ kind: z.literal("ANSWER_TAG_SELECTED"), tag: nonEmptyText })
          .strict(),
        questionIds: z.array(questionId).min(1),
        activePolicy: z.literal("SHOW_AND_VALIDATE"),
        inactivePolicy: z.literal("HIDE_AND_IGNORE_ANSWERS"),
      })
      .strict(),
  })
  .strict();

const entrepreneurCompositionRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("ENTREPRENEUR_COMPOSITION"),
    params: z
      .object({
        moduleId: z.literal("M11"),
        stageQuestionId: z.literal("Q9"),
        challengeQuestionId: z.literal("Q10"),
        stageSource: z.literal("ENTREPRENEUR_STAGES"),
        stageReplaces: z.tuple([
          z.literal("GOAL"),
          z.literal("STEP_1"),
          z.literal("STEP_2"),
          z.literal("STEP_3"),
          z.literal("CHECKPOINT"),
        ]),
        challengeSource: z.literal("ENTREPRENEUR_CHALLENGES"),
        challengeOutputField: z.literal("entrepreneurAdjustments"),
        maxChallenges: z.literal(2),
        challengeOrder: z.literal("ANSWER_SORT_ORDER_ASC"),
        challengeRecommendationSignal: z.literal(true),
        coreStepCount: z.literal(3),
      })
      .strict(),
  })
  .strict();

const fallbackConditionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("ANY_ANSWER_TAG"),
      tags: z.array(nonEmptyText).min(1),
      moduleId,
    })
    .strict(),
  z
    .object({
      kind: z.literal("ANY_ANSWER_ID"),
      answerIds: z.array(answerId).min(1),
      moduleId,
    })
    .strict(),
]);

const fallbackSelectionRuleSchema = z
  .object({
    ...sourceRuleFields,
    ruleKind: z.literal("FALLBACK_SELECTION"),
    params: z
      .object({
        activation: z
          .object({
            kind: z.literal("NO_ELIGIBLE_MODULE_AT_OR_ABOVE_THRESHOLD"),
            thresholdRuleId: z.literal("R05"),
          })
          .strict(),
        conditions: z.array(fallbackConditionSchema).min(1),
        resultPrimaryCount: z.literal(1),
      })
      .strict(),
  })
  .strict();

export const engineRuleSchema = z.discriminatedUnion("ruleKind", [
  weightedScoringRuleSchema,
  tieBreakRuleSchema,
  resultCompositionRuleSchema,
  supportSelectionRuleSchema,
  modifierApplicationRuleSchema,
  recommendationSelectionRuleSchema,
  recommendationPreferenceRuleSchema,
  priorityCaptureRuleSchema,
  paceMappingRuleSchema,
  recommendationDeduplicationRuleSchema,
  contentPolicyRuleSchema,
  moduleGuardRuleSchema,
  conditionalBranchRuleSchema,
  entrepreneurCompositionRuleSchema,
  fallbackSelectionRuleSchema,
]);

export const modifierOperationSchema = z.discriminatedUnion("operationKind", [
  z
    .object({
      operationKind: z.literal("REPLACE_STEP"),
      params: z
        .object({
          stepNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          replacementText: nonEmptyText,
          appliesWhen: z.enum(["ALWAYS", "NO_M11_STAGE"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operationKind: z.literal("APPEND_ADJUSTMENT"),
      params: z
        .object({
          text: nonEmptyText,
          placement: z.literal("AFTER_PRIMARY_STEPS"),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operationKind: z.literal("SET_PRIORITIES"),
      params: z
        .object({
          questionId: z.literal("Q6"),
          resultField: z.literal("priorities"),
          valueSource: z.literal("SELECTED_ANSWER_TEXT"),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operationKind: z.literal("SET_PACE"),
      params: z
        .object({ questionId: z.literal("Q7"), ruleId: z.literal("R10") })
        .strict(),
    })
    .strict(),
  z
    .object({
      operationKind: z.literal("REPLACE_M11_STAGE"),
      params: z
        .object({
          questionId: z.literal("Q9"),
          source: z.literal("ENTREPRENEUR_STAGES"),
          replacesBaseModifierIds: z.array(modifierId),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operationKind: z.literal("APPEND_M11_CHALLENGE"),
      params: z
        .object({
          questionId: z.literal("Q10"),
          source: z.literal("ENTREPRENEUR_CHALLENGES"),
          outputField: z.literal("entrepreneurAdjustments"),
          maxItems: z.literal(2),
          order: z.literal("ANSWER_SORT_ORDER_ASC"),
        })
        .strict(),
    })
    .strict(),
]);

export const documentationExampleSchema = z
  .object({
    stableId: z.string().regex(/^E0[1-7]$/),
    inputSummary: nonEmptyText,
    expectedModuleSummary: nonEmptyText,
    primaryFocus: nonEmptyText,
    stepsSummary: nonEmptyText,
    recommendationsSummary: nonEmptyText,
    sortOrder: z.number().int().min(1).max(7),
    active: z.boolean(),
  })
  .strict();

export type EngineRule = z.infer<typeof engineRuleSchema>;
export type ModifierOperation = z.infer<typeof modifierOperationSchema>;
export type DocumentationExample = z.infer<typeof documentationExampleSchema>;
export type ResultAssemblySection = z.infer<typeof resultAssemblySectionSchema>;

interface SourceRule {
  id: string;
  title: string;
  content: string;
}

function sourceFields(sourceRules: SourceRule[], stableRuleId: string) {
  const source = sourceRules.find((rule) => rule.id === stableRuleId);
  if (!source) throw new Error(`Typed rule source ${stableRuleId} is missing`);
  return {
    stableId: stableRuleId,
    sourceTitle: source.title,
    sourceContent: source.content,
    sortOrder: Number.parseInt(stableRuleId.slice(1), 10),
    active: true,
  };
}

export function createTypedEngineRules(input: {
  sourceSha256: string;
  sourceRules: SourceRule[];
  resultAssemblySections: ResultAssemblySection[];
}): EngineRule[] {
  if (input.sourceSha256 !== APPROVED_TYPED_RULE_SOURCE_SHA256) {
    throw new Error(
      "The XLSX business rules changed after the approved typed-rule decisions.",
    );
  }
  const ids = input.sourceRules.map((rule) => rule.id);
  const expectedIds = Array.from(
    { length: 17 },
    (_, index) => `R${String(index + 1).padStart(2, "0")}`,
  );
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    throw new Error("Business rules must contain ordered R01-R17 exactly once.");
  }

  const rules: EngineRule[] = [
    {
      ...sourceFields(input.sourceRules, "R01"),
      ruleKind: "WEIGHTED_SCORING",
      params: {
        aggregation: "SUM",
        mappingSource: "ANSWER_MODULE_WEIGHTS",
        selectedAnswersOnly: true,
      },
    },
    {
      ...sourceFields(input.sourceRules, "R02"),
      ruleKind: "TIE_BREAK",
      params: {
        questionIds: ["Q2"],
        questionScoreAggregation: "SUM_WEIGHTS",
        finalComparator: null,
      },
    },
    {
      ...sourceFields(input.sourceRules, "R03"),
      ruleKind: "TIE_BREAK",
      params: {
        questionIds: ["Q3", "Q1", "Q5"],
        questionScoreAggregation: "SUM_WEIGHTS",
        finalComparator: "MODULE_SORT_ORDER_ASC",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R04"),
      ruleKind: "RESULT_COMPOSITION",
      params: {
        primaryCount: 1,
        maxSupportCount: 2,
        sections: input.resultAssemblySections,
      },
    },
    {
      ...sourceFields(input.sourceRules, "R05"),
      ruleKind: "SUPPORT_SELECTION",
      params: {
        supportThreshold: 4,
        belowThresholdPolicy: "EXCLUDE",
        noEligibleSupportPolicy: "PRIMARY_ONLY",
        ranking: "MODULE_RANKING",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R06"),
      ruleKind: "MODIFIER_APPLICATION",
      params: {
        nonScoringQuestionIds: ["Q4", "Q6", "Q7", "Q8", "Q9", "Q10"],
        executionOrder: [
          "BASE_MODULE",
          "BASE_MODIFIERS",
          "M11_STAGE",
          "M11_CHALLENGES",
          "PRIORITIES",
          "PACE",
        ],
        conflictPolicy: "ERROR_ON_UNRESOLVED_SAME_TARGET",
        m11StageOverridesModifierIds: ["MOD07", "MOD08"],
      },
    },
    {
      ...sourceFields(input.sourceRules, "R07"),
      ruleKind: "RECOMMENDATION_SELECTION",
      params: {
        maxRecommendations: 3,
        modulePrecedence: ["PRIMARY", "SUPPORT_1", "SUPPORT_2"],
        withinModuleOrder: "PRIORITY_ASC",
        diversityMode: "SOFT",
        diversityCategories: [
          {
            key: "CKO_SERVICE",
            recommendationTypes: ["CKO_SERVICE"],
            requiresConcreteOpportunity: false,
          },
          {
            key: "ECOSYSTEM",
            recommendationTypes: ["EVENT", "CLUB", "FACULTY"],
            requiresConcreteOpportunity: true,
          },
          {
            key: "GENERAL",
            recommendationTypes: ["GENERAL"],
            requiresConcreteOpportunity: false,
          },
        ],
        fillRemainingWithNextEligible: true,
        allowFewerThanMaximum: true,
        slotWithoutOpportunityPolicy: "EXCLUDE",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R08"),
      ruleKind: "RECOMMENDATION_PREFERENCE",
      params: {
        questionId: "Q8",
        selectionOrderPolicy: "IGNORE_CLICK_ORDER",
        multiplePreferencePolicy: "EQUAL_UNION",
        preferredBucketOrder: "NORMAL_CANDIDATE_ORDER",
        answerPreferences: {
          Q8_A1: {
            recommendationIds: ["CKO_DIGEST"],
            recommendationTypes: ["GENERAL"],
            defaultMix: false,
          },
          Q8_A2: {
            recommendationIds: ["CKO_CONSULT"],
            recommendationTypes: [],
            defaultMix: false,
          },
          Q8_A3: {
            recommendationIds: [],
            recommendationTypes: ["EVENT"],
            defaultMix: false,
          },
          Q8_A4: {
            recommendationIds: ["CKO_PRACTICE"],
            recommendationTypes: ["CLUB", "FACULTY"],
            defaultMix: false,
          },
          Q8_A5: {
            recommendationIds: [],
            recommendationTypes: [],
            defaultMix: true,
          },
        },
      },
    },
    {
      ...sourceFields(input.sourceRules, "R09"),
      ruleKind: "PRIORITY_CAPTURE",
      params: {
        questionId: "Q6",
        resultField: "priorities",
        valueSource: "ANSWER_TEXT",
        minItems: 1,
        maxItems: 3,
        allowedKeys: [
          "priority_tasks",
          "priority_growth",
          "priority_income",
          "priority_flex",
          "priority_stability",
          "priority_team",
          "priority_autonomy",
        ],
        recommendationTagField: "priorityTags",
        recommendationMatching: "SOFT_PREFERRED_FIRST",
        untaggedCandidatePolicy: "KEEP_ELIGIBLE",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R10"),
      ruleKind: "PACE_MAPPING",
      params: {
        questionId: "Q7",
        values: [
          {
            answerId: "Q7_A1",
            key: "pace_light",
            actionsPerWeekMin: 1,
            actionsPerWeekMax: 1,
            parallelExperimentAllowed: false,
            text: "Лёгкий темп: 1 небольшой шаг в неделю.",
          },
          {
            answerId: "Q7_A2",
            key: "pace_normal",
            actionsPerWeekMin: 2,
            actionsPerWeekMax: 3,
            parallelExperimentAllowed: false,
            text: "Обычный темп: 2–3 действия в неделю.",
          },
          {
            answerId: "Q7_A3",
            key: "pace_active",
            actionsPerWeekMin: 3,
            actionsPerWeekMax: 4,
            parallelExperimentAllowed: false,
            text: "Активный темп: 3–4 действия в неделю.",
          },
          {
            answerId: "Q7_A4",
            key: "pace_intensive",
            actionsPerWeekMin: null,
            actionsPerWeekMax: null,
            parallelExperimentAllowed: true,
            text: "Интенсивный темп: можно вести параллельный эксперимент.",
          },
        ],
        preservesCoreStepCount: 3,
        addAutomaticCoreStep: false,
      },
    },
    {
      ...sourceFields(input.sourceRules, "R11"),
      ruleKind: "RECOMMENDATION_DEDUPLICATION",
      params: {
        scope: "RESULT",
        keys: ["RECOMMENDATION_ID", "OPPORTUNITY_ID"],
        keep: "FIRST_BY_CANDIDATE_ORDER",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R12"),
      ruleKind: "CONTENT_POLICY",
      params: {
        triggerAnswerIds: ["Q2_A8"],
        targetModuleId: "M05",
        modifierIds: ["MOD06"],
        prohibitedClaims: ["ATS_BYPASS"],
        requiredFraming: [
          "RELEVANCE",
          "READABILITY",
          "ADAPTATION",
          "CONVERSION",
        ],
      },
    },
    {
      ...sourceFields(input.sourceRules, "R13"),
      ruleKind: "MODULE_GUARD",
      params: {
        moduleId: "M09",
        allowPrimaryWhen: {
          kind: "ANY_ANSWER_ID",
          answerIds: ["Q1_A5", "Q2_A13", "Q3_A10"],
        },
        blockedPolicy: "REMOVE_FROM_PRIMARY_CANDIDATES",
        scope: "ALL_RANKING",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R14"),
      ruleKind: "MODULE_GUARD",
      params: {
        moduleId: "M11",
        allowPrimaryWhen: {
          kind: "ANY_ANSWER_TAG",
          tags: ["entrepreneur_signal"],
        },
        blockedPolicy: "REMOVE_FROM_PRIMARY_CANDIDATES",
        scope: "ALL_RANKING",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R15"),
      ruleKind: "CONDITIONAL_BRANCH",
      params: {
        condition: {
          kind: "ANSWER_TAG_SELECTED",
          tag: "entrepreneur_signal",
        },
        questionIds: ["Q9", "Q10"],
        activePolicy: "SHOW_AND_VALIDATE",
        inactivePolicy: "HIDE_AND_IGNORE_ANSWERS",
      },
    },
    {
      ...sourceFields(input.sourceRules, "R16"),
      ruleKind: "ENTREPRENEUR_COMPOSITION",
      params: {
        moduleId: "M11",
        stageQuestionId: "Q9",
        challengeQuestionId: "Q10",
        stageSource: "ENTREPRENEUR_STAGES",
        stageReplaces: ["GOAL", "STEP_1", "STEP_2", "STEP_3", "CHECKPOINT"],
        challengeSource: "ENTREPRENEUR_CHALLENGES",
        challengeOutputField: "entrepreneurAdjustments",
        maxChallenges: 2,
        challengeOrder: "ANSWER_SORT_ORDER_ASC",
        challengeRecommendationSignal: true,
        coreStepCount: 3,
      },
    },
    {
      ...sourceFields(input.sourceRules, "R17"),
      ruleKind: "FALLBACK_SELECTION",
      params: {
        activation: {
          kind: "NO_ELIGIBLE_MODULE_AT_OR_ABOVE_THRESHOLD",
          thresholdRuleId: "R05",
        },
        conditions: [
          {
            kind: "ANY_ANSWER_TAG",
            tags: ["entrepreneur_signal"],
            moduleId: "M11",
          },
          { kind: "ANY_ANSWER_ID", answerIds: ["Q1_A1"], moduleId: "M01" },
          {
            kind: "ANY_ANSWER_ID",
            answerIds: ["Q1_A2", "Q1_A3", "Q1_A4", "Q1_A5"],
            moduleId: "M02",
          },
          { kind: "ANY_ANSWER_ID", answerIds: ["Q1_A6"], moduleId: "M10" },
        ],
        resultPrimaryCount: 1,
      },
    },
  ];

  return z.array(engineRuleSchema).length(17).parse(rules);
}

export function createModifierOperation(
  stableModifierId: string,
  sourceEffect: string,
): ModifierOperation {
  const replacements: Record<
    string,
    { stepNumber: 1 | 2 | 3; replacementText: string; appliesWhen: "ALWAYS" | "NO_M11_STAGE" }
  > = {
    MOD01: {
      stepNumber: 3,
      replacementText: "Проверьте выбранную роль на реальных вакансиях.",
      appliesWhen: "ALWAYS",
    },
    MOD02: {
      stepNumber: 1,
      replacementText: "Проведите аудит и адаптацию актуального резюме.",
      appliesWhen: "ALWAYS",
    },
    MOD03: {
      stepNumber: 3,
      replacementText: "Усильте и упакуйте существующие кейсы.",
      appliesWhen: "ALWAYS",
    },
    MOD04: {
      stepNumber: 2,
      replacementText: "Упакуйте текущий опыт и найдите следующий более сильный кейс.",
      appliesWhen: "ALWAYS",
    },
    MOD05: {
      stepNumber: 2,
      replacementText: "Расширьте каналы и проверьте качество текущего списка.",
      appliesWhen: "ALWAYS",
    },
    MOD07: {
      stepNumber: 1,
      replacementText: "Сформулируйте аудиторию и проблему, затем перейдите к проверке спроса.",
      appliesWhen: "NO_M11_STAGE",
    },
    MOD08: {
      stepNumber: 2,
      replacementText:
        "Соберите обратную связь пользователей и проверьте повторяемость спроса и бизнес-модель.",
      appliesWhen: "NO_M11_STAGE",
    },
  };
  const replacement = replacements[stableModifierId];
  if (replacement) {
    return modifierOperationSchema.parse({
      operationKind: "REPLACE_STEP",
      params: replacement,
    });
  }

  const operations: Record<string, ModifierOperation> = {
    MOD06: {
      operationKind: "APPEND_ADJUSTMENT",
      params: { text: sourceEffect, placement: "AFTER_PRIMARY_STEPS" },
    },
    MOD09: {
      operationKind: "SET_PRIORITIES",
      params: {
        questionId: "Q6",
        resultField: "priorities",
        valueSource: "SELECTED_ANSWER_TEXT",
      },
    },
    MOD10: {
      operationKind: "SET_PACE",
      params: { questionId: "Q7", ruleId: "R10" },
    },
    MOD11: {
      operationKind: "REPLACE_M11_STAGE",
      params: {
        questionId: "Q9",
        source: "ENTREPRENEUR_STAGES",
        replacesBaseModifierIds: ["MOD07", "MOD08"],
      },
    },
    MOD12: {
      operationKind: "APPEND_M11_CHALLENGE",
      params: {
        questionId: "Q10",
        source: "ENTREPRENEUR_CHALLENGES",
        outputField: "entrepreneurAdjustments",
        maxItems: 2,
        order: "ANSWER_SORT_ORDER_ASC",
      },
    },
  };
  const operation = operations[stableModifierId];
  if (!operation) throw new Error(`No typed operation for ${stableModifierId}`);
  return modifierOperationSchema.parse(operation);
}
