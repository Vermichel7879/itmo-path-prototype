import { z } from "zod";

import {
  documentationExampleSchema,
  engineRuleSchema,
  modifierOperationSchema,
  type ModifierOperation,
} from "../config/typed-rules";

const stableId = z.string().trim().min(1);
const nonEmptyText = z.string().trim().min(1);

export const showConditionSchema = z
  .object({ expression: nonEmptyText })
  .strict();

export const modifierEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("copy"), description: nonEmptyText }).strict(),
  z.object({ kind: z.literal("pace"), description: nonEmptyText }).strict(),
]);

export const questionImportSchema = z
  .object({
    stableId,
    block: nonEmptyText,
    text: nonEmptyText,
    selectionType: z.enum(["SINGLE", "MULTI"]),
    minSelect: z.number().int().nonnegative(),
    maxSelect: z.number().int().positive(),
    required: z.boolean(),
    sortOrder: z.number().int().positive(),
    showCondition: showConditionSchema.nullable(),
    active: z.boolean(),
  })
  .strict();

export const answerImportSchema = z
  .object({
    stableId,
    questionStableId: stableId,
    text: nonEmptyText,
    sortOrder: z.number().int().positive(),
    tags: z.array(nonEmptyText),
    keys: z.array(nonEmptyText),
    active: z.boolean(),
  })
  .strict();

export const mappingImportSchema = z
  .object({
    answerStableId: stableId,
    questionStableId: stableId,
    moduleStableId: stableId,
    weight: z.number().int(),
  })
  .strict();

export const moduleImportSchema = z
  .object({
    stableId,
    name: nonEmptyText,
    goal: nonEmptyText,
    steps: z.tuple([nonEmptyText, nonEmptyText, nonEmptyText]),
    checkpoint: nonEmptyText,
    recommendationStableIds: z.array(stableId),
    constraints: z.string().trim(),
    sortOrder: z.number().int().positive(),
    active: z.boolean(),
  })
  .strict();

export const modifierImportSchema = z
  .object({
    stableId,
    triggerAnswerPattern: nonEmptyText,
    triggerTag: z.string().trim().nullable(),
    targetModuleStableId: nonEmptyText,
    type: z.enum(["COPY", "PACE"]),
    variantKey: nonEmptyText,
    effect: modifierEffectSchema,
    operation: modifierOperationSchema,
    active: z.boolean(),
  })
  .strict();

export const recommendationImportSchema = z
  .object({
    stableId,
    type: z.enum(["CKO_SERVICE", "EVENT", "CLUB", "FACULTY", "GENERAL"]),
    title: nonEmptyText,
    description: nonEmptyText,
    url: z.url().nullable(),
    status: z.enum(["ACTIVE", "SLOT", "INACTIVE"]),
    tags: z.array(nonEmptyText),
    priorityTags: z.array(nonEmptyText),
    active: z.boolean(),
  })
  .strict();

export const moduleRecommendationImportSchema = z
  .object({
    moduleStableId: stableId,
    recommendationStableId: stableId,
    priority: z.number().int().positive(),
  })
  .strict();

export const entrepreneurStageImportSchema = z
  .object({
    stableId,
    answerStableId: stableId,
    targetModuleStableId: stableId,
    answerText: nonEmptyText,
    focus: nonEmptyText,
    steps: z.tuple([nonEmptyText, nonEmptyText, nonEmptyText]),
    checkpoint: nonEmptyText,
    sortOrder: z.number().int().positive(),
    active: z.boolean(),
  })
  .strict();

export const entrepreneurChallengeImportSchema = z
  .object({
    stableId,
    answerStableId: stableId,
    targetModuleStableId: stableId,
    answerText: nonEmptyText,
    trajectoryAdjustment: nonEmptyText,
    recommendationStableId: stableId,
    sortOrder: z.number().int().positive(),
    active: z.boolean(),
  })
  .strict();

const sourceNoteSchema = z
  .object({ id: nonEmptyText, title: nonEmptyText, content: nonEmptyText })
  .strict();

function validateModifierOperationReferences(
  operation: ModifierOperation,
  references: {
    answers: Map<string, unknown>;
    questions: Map<string, unknown>;
    modifiers: Set<string>;
    answerTags: Set<string>;
  },
  context: z.RefinementCtx,
  path: (string | number)[],
) {
  const requireQuestion = (id: string) => {
    if (!references.questions.has(id)) {
      context.addIssue({ code: "custom", path, message: `question ${id} not found` });
    }
  };
  if (operation.operationKind === "SET_PRIORITIES") {
    requireQuestion(operation.params.questionId);
  }
  if (operation.operationKind === "SET_PACE") {
    requireQuestion(operation.params.questionId);
  }
  if (operation.operationKind === "REPLACE_M11_STAGE") {
    requireQuestion(operation.params.questionId);
    operation.params.replacesBaseModifierIds.forEach((id) => {
      if (!references.modifiers.has(id)) {
        context.addIssue({ code: "custom", path, message: `modifier ${id} not found` });
      }
    });
  }
  if (operation.operationKind === "APPEND_M11_CHALLENGE") {
    requireQuestion(operation.params.questionId);
  }
}

export const careerImportSchema = z
  .object({
    source: z
      .object({
        fileName: nonEmptyText,
        sha256: z.string().regex(/^[A-F0-9]{64}$/),
        workbookVersion: nonEmptyText,
        recognizedSheets: z.array(nonEmptyText),
        readme: z.record(z.string(), z.string()),
      })
      .strict(),
    questions: z.array(questionImportSchema),
    answers: z.array(answerImportSchema),
    mappings: z.array(mappingImportSchema),
    modules: z.array(moduleImportSchema),
    modifiers: z.array(modifierImportSchema),
    recommendations: z.array(recommendationImportSchema),
    moduleRecommendations: z.array(moduleRecommendationImportSchema),
    entrepreneurStages: z.array(entrepreneurStageImportSchema),
    entrepreneurChallenges: z.array(entrepreneurChallengeImportSchema),
    engineRules: z.array(engineRuleSchema),
    documentationExamples: z.array(documentationExampleSchema),
    editingInstructions: z.array(sourceNoteSchema),
  })
  .strict()
  .superRefine((config, context) => {
    const unique = <T>(
      values: T[],
      key: (value: T) => string,
      path: string,
    ) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        const id = key(value);
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            path: [path, index],
            message: `дублирующийся ID/ключ ${id}`,
          });
        }
        seen.add(id);
      });
    };

    unique(config.questions, (item) => item.stableId, "questions");
    unique(config.answers, (item) => item.stableId, "answers");
    unique(config.modules, (item) => item.stableId, "modules");
    unique(config.modifiers, (item) => item.stableId, "modifiers");
    unique(config.recommendations, (item) => item.stableId, "recommendations");
    unique(config.entrepreneurStages, (item) => item.stableId, "entrepreneurStages");
    unique(
      config.entrepreneurChallenges,
      (item) => item.stableId,
      "entrepreneurChallenges",
    );
    unique(config.engineRules, (item) => item.stableId, "engineRules");
    unique(
      config.documentationExamples,
      (item) => item.stableId,
      "documentationExamples",
    );
    unique(
      config.mappings,
      (item) => `${item.answerStableId}:${item.moduleStableId}`,
      "mappings",
    );
    unique(
      config.moduleRecommendations,
      (item) => `${item.moduleStableId}:${item.recommendationStableId}`,
      "moduleRecommendations",
    );

    const questions = new Map(config.questions.map((item) => [item.stableId, item]));
    const answers = new Map(config.answers.map((item) => [item.stableId, item]));
    const modules = new Set(config.modules.map((item) => item.stableId));
    const recommendations = new Set(
      config.recommendations.map((item) => item.stableId),
    );
    const modifiers = new Set(config.modifiers.map((item) => item.stableId));
    const answerTags = new Set(config.answers.flatMap((item) => item.tags));
    const answerKeys = new Set(config.answers.flatMap((item) => item.keys));

    const expectedRuleIds = Array.from(
      { length: 17 },
      (_, index) => `R${String(index + 1).padStart(2, "0")}`,
    );
    const actualRuleIds = config.engineRules
      .map((rule) => rule.stableId)
      .sort();
    if (JSON.stringify(actualRuleIds) !== JSON.stringify(expectedRuleIds)) {
      context.addIssue({
        code: "custom",
        path: ["engineRules"],
        message: "engineRules must contain R01-R17 exactly once",
      });
    }

    const expectedExampleIds = Array.from(
      { length: 7 },
      (_, index) => `E${String(index + 1).padStart(2, "0")}`,
    );
    const actualExampleIds = config.documentationExamples
      .map((example) => example.stableId)
      .sort();
    if (JSON.stringify(actualExampleIds) !== JSON.stringify(expectedExampleIds)) {
      context.addIssue({
        code: "custom",
        path: ["documentationExamples"],
        message: "documentationExamples must contain E01-E07 exactly once",
      });
    }

    config.questions.forEach((question, index) => {
      if (question.minSelect > question.maxSelect) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "minSelect"],
          message: "min_select не может быть больше max_select",
        });
      }
      if (question.required && question.minSelect < 1) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "minSelect"],
          message: "обязательный вопрос должен требовать хотя бы один ответ",
        });
      }
      if (question.selectionType === "SINGLE" && question.maxSelect !== 1) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "maxSelect"],
          message: "single-вопрос должен иметь max_select = 1",
        });
      }
    });

    config.answers.forEach((answer, index) => {
      if (!questions.has(answer.questionStableId)) {
        context.addIssue({
          code: "custom",
          path: ["answers", index, "questionStableId"],
          message: `вопрос ${answer.questionStableId} не найден`,
        });
      }
    });

    config.questions.forEach((question, index) => {
      const answerCount = config.answers.filter(
        (answer) => answer.questionStableId === question.stableId && answer.active,
      ).length;
      if (question.maxSelect > answerCount) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "maxSelect"],
          message: `max_select ${question.maxSelect} больше числа активных ответов ${answerCount}`,
        });
      }
    });

    config.mappings.forEach((mapping, index) => {
      const answer = answers.get(mapping.answerStableId);
      if (!answer) {
        context.addIssue({
          code: "custom",
          path: ["mappings", index, "answerStableId"],
          message: `ответ ${mapping.answerStableId} не найден`,
        });
      } else if (answer.questionStableId !== mapping.questionStableId) {
        context.addIssue({
          code: "custom",
          path: ["mappings", index, "questionStableId"],
          message: `ответ ${mapping.answerStableId} принадлежит ${answer.questionStableId}`,
        });
      }
      if (!modules.has(mapping.moduleStableId)) {
        context.addIssue({
          code: "custom",
          path: ["mappings", index, "moduleStableId"],
          message: `модуль ${mapping.moduleStableId} не найден`,
        });
      }
    });

    config.moduleRecommendations.forEach((link, index) => {
      if (!modules.has(link.moduleStableId)) {
        context.addIssue({
          code: "custom",
          path: ["moduleRecommendations", index, "moduleStableId"],
          message: `модуль ${link.moduleStableId} не найден`,
        });
      }
      if (!recommendations.has(link.recommendationStableId)) {
        context.addIssue({
          code: "custom",
          path: ["moduleRecommendations", index, "recommendationStableId"],
          message: `рекомендация ${link.recommendationStableId} не найдена`,
        });
      }
    });

    config.modifiers.forEach((modifier, index) => {
      if (
        !modifier.triggerAnswerPattern.includes("*") &&
        !answers.has(modifier.triggerAnswerPattern)
      ) {
        context.addIssue({
          code: "custom",
          path: ["modifiers", index, "triggerAnswerPattern"],
          message: `ответ ${modifier.triggerAnswerPattern} не найден`,
        });
      }
      if (
        modifier.targetModuleStableId !== "ALL" &&
        !modules.has(modifier.targetModuleStableId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["modifiers", index, "targetModuleStableId"],
          message: `модуль ${modifier.targetModuleStableId} не найден`,
        });
      }
      validateModifierOperationReferences(
        modifier.operation,
        { answers, questions, modifiers, answerTags },
        context,
        ["modifiers", index, "operation"],
      );
    });

    config.engineRules.forEach((rule, index) => {
      const path = ["engineRules", index, "params"] as (string | number)[];
      const requireQuestion = (id: string) => {
        if (!questions.has(id)) {
          context.addIssue({ code: "custom", path, message: `question ${id} not found` });
        }
      };
      const requireAnswer = (id: string) => {
        if (!answers.has(id)) {
          context.addIssue({ code: "custom", path, message: `answer ${id} not found` });
        }
      };
      const requireModule = (id: string) => {
        if (!modules.has(id)) {
          context.addIssue({ code: "custom", path, message: `module ${id} not found` });
        }
      };
      const requireModifier = (id: string) => {
        if (!modifiers.has(id)) {
          context.addIssue({ code: "custom", path, message: `modifier ${id} not found` });
        }
      };
      const requireTag = (tag: string) => {
        if (!answerTags.has(tag)) {
          context.addIssue({ code: "custom", path, message: `answer tag ${tag} not found` });
        }
      };

      switch (rule.ruleKind) {
        case "TIE_BREAK":
          rule.params.questionIds.forEach(requireQuestion);
          break;
        case "MODIFIER_APPLICATION":
          rule.params.nonScoringQuestionIds.forEach(requireQuestion);
          rule.params.m11StageOverridesModifierIds.forEach(requireModifier);
          break;
        case "RECOMMENDATION_PREFERENCE":
          requireQuestion(rule.params.questionId);
          Object.entries(rule.params.answerPreferences).forEach(
            ([id, preference]) => {
              requireAnswer(id);
              preference.recommendationIds.forEach((recommendationId) => {
                if (!recommendations.has(recommendationId)) {
                  context.addIssue({
                    code: "custom",
                    path,
                    message: `recommendation ${recommendationId} not found`,
                  });
                }
              });
            },
          );
          break;
        case "PRIORITY_CAPTURE":
          requireQuestion(rule.params.questionId);
          rule.params.allowedKeys.forEach((key) => {
            if (!answerKeys.has(key)) {
              context.addIssue({ code: "custom", path, message: `answer key ${key} not found` });
            }
          });
          break;
        case "PACE_MAPPING":
          requireQuestion(rule.params.questionId);
          rule.params.values.forEach((value) => requireAnswer(value.answerId));
          break;
        case "CONTENT_POLICY":
          rule.params.triggerAnswerIds.forEach(requireAnswer);
          requireModule(rule.params.targetModuleId);
          rule.params.modifierIds.forEach(requireModifier);
          break;
        case "MODULE_GUARD":
          requireModule(rule.params.moduleId);
          if (rule.params.allowPrimaryWhen.kind === "ANY_ANSWER_ID") {
            rule.params.allowPrimaryWhen.answerIds.forEach(requireAnswer);
          } else {
            rule.params.allowPrimaryWhen.tags.forEach(requireTag);
          }
          break;
        case "CONDITIONAL_BRANCH":
          rule.params.questionIds.forEach(requireQuestion);
          requireTag(rule.params.condition.tag);
          break;
        case "ENTREPRENEUR_COMPOSITION":
          requireModule(rule.params.moduleId);
          requireQuestion(rule.params.stageQuestionId);
          requireQuestion(rule.params.challengeQuestionId);
          break;
        case "FALLBACK_SELECTION":
          rule.params.conditions.forEach((condition) => {
            requireModule(condition.moduleId);
            if (condition.kind === "ANY_ANSWER_ID") {
              condition.answerIds.forEach(requireAnswer);
            } else {
              condition.tags.forEach(requireTag);
            }
          });
          break;
        default:
          break;
      }
    });

    const validateEntrepreneurItem = (
      item: { answerStableId: string; targetModuleStableId: string },
      path: "entrepreneurStages" | "entrepreneurChallenges",
      index: number,
    ) => {
      if (!answers.has(item.answerStableId)) {
        context.addIssue({
          code: "custom",
          path: [path, index, "answerStableId"],
          message: `ответ ${item.answerStableId} не найден`,
        });
      }
      if (!modules.has(item.targetModuleStableId)) {
        context.addIssue({
          code: "custom",
          path: [path, index, "targetModuleStableId"],
          message: `модуль ${item.targetModuleStableId} не найден`,
        });
      }
    };

    config.entrepreneurStages.forEach((item, index) =>
      validateEntrepreneurItem(item, "entrepreneurStages", index),
    );
    config.entrepreneurChallenges.forEach((item, index) => {
      validateEntrepreneurItem(item, "entrepreneurChallenges", index);
      if (!recommendations.has(item.recommendationStableId)) {
        context.addIssue({
          code: "custom",
          path: ["entrepreneurChallenges", index, "recommendationStableId"],
          message: `рекомендация ${item.recommendationStableId} не найдена`,
        });
      }
    });
  });

export type CareerImport = z.infer<typeof careerImportSchema>;
export type ModifierEffect = z.infer<typeof modifierEffectSchema>;
export type { ModifierOperation };

export function validateCareerImport(input: unknown): CareerImport {
  const result = careerImportSchema.safeParse(input);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Ошибка валидации импорта:\n${details}`);
}
