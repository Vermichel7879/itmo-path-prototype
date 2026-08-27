import "server-only";

import { z } from "zod";

import { requireCapability, type AdminRole } from "@/lib/auth/permissions";
import {
  type CareerImport,
  validateCareerImport,
} from "@/lib/db/import/import-model";
import { AdminDataApiError } from "@/lib/supabase/admin-rpc";

import { adminDataApi } from "./data-api";
import { validateDraftCareerConfig } from "./validation";
import { assertExpectedRevision } from "./concurrency";

const timestampToken = z.iso.datetime({ offset: true });
const stableId = z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,99}$/);
const mappingStableId = z.string().regex(/^[A-Z0-9_]+:[A-Z0-9_]+$/);
const mappingWeight = z.number().int().min(-10).max(10);
const moduleRecommendationPriority = z.number().int().positive();

export const draftMutationSchema = z.discriminatedUnion("entityType", [
  z.object({
    entityType: z.literal("QUESTION_CREATE"),
    stableId: z.string().regex(/^Q\d+$/),
    expectedUpdatedAt: timestampToken,
    values: z.object({
      block: z.string().trim().min(1),
      text: z.string().trim().min(1),
      selectionType: z.enum(["SINGLE", "MULTI"]),
      minSelect: z.number().int().nonnegative(),
      maxSelect: z.number().int().positive(),
      required: z.boolean(),
      sortOrder: z.number().int().positive(),
      showCondition: z.object({ expression: z.literal("entrepreneur_signal = true") }).nullable(),
      forBachelor: z.boolean().default(false),
      forMaster: z.boolean().default(true),
      firstAnswer: z.object({ stableId: z.string().regex(/^Q\d+_A\d+$/), text: z.string().trim().min(1) }),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("ANSWER_CREATE"),
    stableId: z.string().regex(/^Q\d+_A\d+$/),
    expectedUpdatedAt: timestampToken,
    values: z.object({
      questionStableId: z.string().regex(/^Q\d+$/),
      text: z.string().trim().min(1),
      sortOrder: z.number().int().positive(),
      tags: z.array(z.string().trim().min(1)).default([]),
      keys: z.array(z.string().trim().min(1)).default([]),
      active: z.boolean().default(true),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("RECOMMENDATION_CREATE"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      type: z.enum(["CKO_SERVICE", "EVENT", "CLUB", "FACULTY", "GENERAL"]),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      url: z.url().nullable(),
      status: z.enum(["ACTIVE", "SLOT", "INACTIVE"]),
      tags: z.array(z.string().trim().min(1)).default([]),
      priorityTags: z.array(z.string().trim().min(1)).default([]),
      active: z.boolean().default(true),
      forBachelor: z.boolean().default(false),
      forMaster: z.boolean().default(true),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("QUESTION"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      text: z.string().trim().min(1).optional(),
      block: z.string().trim().min(1).optional(),
      minSelect: z.number().int().nonnegative().optional(),
      maxSelect: z.number().int().positive().optional(),
      required: z.boolean().optional(),
      sortOrder: z.number().int().positive().optional(),
      active: z.boolean().optional(),
      showCondition: z.object({ expression: z.string().trim().min(1) }).nullable().optional(),
      forBachelor: z.boolean().optional(),
      forMaster: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("ANSWER"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      text: z.string().trim().min(1).optional(),
      sortOrder: z.number().int().positive().optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
      keys: z.array(z.string().trim().min(1)).optional(),
      active: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("MODULE"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      name: z.string().trim().min(1).optional(),
      goal: z.string().trim().min(1).optional(),
      step1: z.string().trim().min(1).optional(),
      step2: z.string().trim().min(1).optional(),
      step3: z.string().trim().min(1).optional(),
      checkpoint: z.string().trim().min(1).optional(),
      constraints: z.string().trim().optional(),
      sortOrder: z.number().int().positive().optional(),
      active: z.boolean().optional(),
      forBachelor: z.boolean().optional(),
      forMaster: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("RECOMMENDATION"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).optional(),
      url: z.url().nullable().optional(),
      status: z.enum(["ACTIVE", "SLOT", "INACTIVE"]).optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
      priorityTags: z.array(z.string().trim().min(1)).optional(),
      active: z.boolean().optional(),
      forBachelor: z.boolean().optional(),
      forMaster: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("OPPORTUNITY"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      type: z.enum(["EVENT", "CLUB", "FACULTY", "PRACTICE", "INTERNSHIP", "OTHER"]).optional(),
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).optional(),
      url: z.url().nullable().optional(),
      startsAt: timestampToken.nullable().optional(),
      endsAt: timestampToken.nullable().optional(),
      validFrom: timestampToken.nullable().optional(),
      validTo: timestampToken.nullable().optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
      active: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("WEIGHT"),
    stableId: mappingStableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({ weight: mappingWeight }).strict(),
  }),
  z.object({
    entityType: z.enum(["MAPPING_CREATE", "MAPPING_UPDATE"]),
    stableId: mappingStableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({ weight: mappingWeight }).strict(),
  }),
  z.object({
    entityType: z.literal("MAPPING_DELETE"),
    stableId: mappingStableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({}).strict(),
  }),
  z.object({
    entityType: z.enum([
      "MODULE_RECOMMENDATION_CREATE",
      "MODULE_RECOMMENDATION_UPDATE",
    ]),
    stableId: mappingStableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({ priority: moduleRecommendationPriority }).strict(),
  }),
  z.object({
    entityType: z.literal("MODULE_RECOMMENDATION_DELETE"),
    stableId: mappingStableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({}).strict(),
  }),
  z.object({
    entityType: z.literal("RULE"),
    stableId: z.string().regex(/^R(0[1-9]|1[0-7])$/),
    expectedUpdatedAt: timestampToken,
    values: z.object({
      sourceTitle: z.string().trim().min(1).optional(),
      sourceContent: z.string().trim().min(1).optional(),
      params: z.unknown().optional(),
      active: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    entityType: z.literal("MODIFIER"),
    stableId,
    expectedUpdatedAt: timestampToken,
    values: z.object({
      effect: z.unknown().optional(),
      operationParams: z.unknown().optional(),
      active: z.boolean().optional(),
    }).strict(),
  }),
]);

export type DraftMutation = z.infer<typeof draftMutationSchema>;

export class DraftConflictError extends Error {
  readonly status = 409;
  constructor() {
    super("DRAFT_STALE_REVISION");
    this.name = "DraftConflictError";
  }
}

export async function getCurrentDraftConfig() {
  const draft = await adminDataApi.getDraft();
  const snapshot = validateCareerImport(draft.snapshot);
  return {
    id: draft.id,
    updatedAt: draft.updatedAt,
    snapshotHash: draft.snapshotHash,
    snapshot,
    validation: validateDraftCareerConfig(snapshot),
  };
}

export function applyDraftMutationToSnapshot(
  current: CareerImport,
  mutation: DraftMutation,
): CareerImport {
  const snapshot = structuredClone(current);
  const required = <T extends { stableId: string }>(
    collection: T[],
    stableIdValue: string,
    error: string,
  ) => {
    const entity = collection.find((item) => item.stableId === stableIdValue);
    if (!entity) throw new Error(error);
    return entity;
  };
  const mappingReferences = (stableIdValue: string, checkAudience: boolean) => {
    const [answerStableId, moduleStableId] = stableIdValue.split(":");
    const answer = snapshot.answers.find((item) => item.stableId === answerStableId);
    if (!answer) throw new Error("ANSWER_NOT_FOUND");
    const careerModule = snapshot.modules.find((item) => item.stableId === moduleStableId);
    if (!careerModule) throw new Error("MODULE_NOT_FOUND");
    const question = snapshot.questions.find(
      (item) => item.stableId === answer.questionStableId,
    );
    if (!question) throw new Error("QUESTION_NOT_FOUND");
    if (
      checkAudience &&
      !(
        (question.forBachelor && careerModule.forBachelor) ||
        (question.forMaster && careerModule.forMaster)
      )
    ) {
      throw new Error("MAPPING_AUDIENCE_INCOMPATIBLE");
    }
    return { answer, careerModule };
  };
  const moduleRecommendationReferences = (
    stableIdValue: string,
    checkAudience: boolean,
  ) => {
    const [moduleStableId, recommendationStableId] = stableIdValue.split(":");
    const careerModule = snapshot.modules.find(
      (item) => item.stableId === moduleStableId,
    );
    if (!careerModule) throw new Error("MODULE_NOT_FOUND");
    const recommendation = snapshot.recommendations.find(
      (item) => item.stableId === recommendationStableId,
    );
    if (!recommendation) throw new Error("RECOMMENDATION_NOT_FOUND");
    if (
      checkAudience &&
      !(
        (careerModule.forBachelor && recommendation.forBachelor) ||
        (careerModule.forMaster && recommendation.forMaster)
      )
    ) {
      throw new Error("MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE");
    }
    return { careerModule, recommendation };
  };

  switch (mutation.entityType) {
    case "QUESTION_CREATE": {
      if (!mutation.values.firstAnswer.stableId.startsWith(`${mutation.stableId}_A`)) {
        throw new Error("ANSWER_ID_QUESTION_MISMATCH");
      }
      snapshot.questions.push({
        stableId: mutation.stableId,
        block: mutation.values.block,
        text: mutation.values.text,
        selectionType: mutation.values.selectionType,
        minSelect: mutation.values.minSelect,
        maxSelect: mutation.values.maxSelect,
        required: mutation.values.required,
        sortOrder: mutation.values.sortOrder,
        showCondition: mutation.values.showCondition,
        active: true,
        forBachelor: mutation.values.forBachelor,
        forMaster: mutation.values.forMaster,
      });
      snapshot.answers.push({
        stableId: mutation.values.firstAnswer.stableId,
        questionStableId: mutation.stableId,
        text: mutation.values.firstAnswer.text,
        sortOrder: 1,
        tags: [],
        keys: [],
        active: true,
      });
      break;
    }
    case "ANSWER_CREATE": {
      if (!mutation.stableId.startsWith(`${mutation.values.questionStableId}_A`)) {
        throw new Error("ANSWER_ID_QUESTION_MISMATCH");
      }
      required(
        snapshot.questions,
        mutation.values.questionStableId,
        "QUESTION_NOT_FOUND",
      );
      snapshot.answers.push({
        stableId: mutation.stableId,
        questionStableId: mutation.values.questionStableId,
        text: mutation.values.text,
        sortOrder: mutation.values.sortOrder,
        tags: mutation.values.tags,
        keys: mutation.values.keys,
        active: mutation.values.active,
      });
      break;
    }
    case "RECOMMENDATION_CREATE": {
      snapshot.recommendations.push({
        stableId: mutation.stableId,
        ...mutation.values,
      });
      break;
    }
    case "QUESTION": {
      Object.assign(
        required(snapshot.questions, mutation.stableId, "QUESTION_NOT_FOUND"),
        mutation.values,
      );
      break;
    }
    case "ANSWER": {
      Object.assign(
        required(snapshot.answers, mutation.stableId, "ANSWER_NOT_FOUND"),
        mutation.values,
      );
      break;
    }
    case "MODULE": {
      const careerModule = required(
        snapshot.modules,
        mutation.stableId,
        "MODULE_NOT_FOUND",
      );
      const { step1, step2, step3, ...values } = mutation.values;
      Object.assign(careerModule, values);
      if (step1 !== undefined) careerModule.steps[0] = step1;
      if (step2 !== undefined) careerModule.steps[1] = step2;
      if (step3 !== undefined) careerModule.steps[2] = step3;
      break;
    }
    case "RECOMMENDATION": {
      Object.assign(
        required(
          snapshot.recommendations,
          mutation.stableId,
          "RECOMMENDATION_NOT_FOUND",
        ),
        mutation.values,
      );
      break;
    }
    case "OPPORTUNITY": {
      const opportunity = snapshot.opportunities.find(
        (item) => item.stableId === mutation.stableId,
      );
      if (opportunity) {
        Object.assign(opportunity, mutation.values);
      } else {
        const values = mutation.values;
        if (!values.type || !values.title || !values.description) {
          throw new Error("OPPORTUNITY_CREATE_FIELDS_REQUIRED");
        }
        snapshot.opportunities.push({
          stableId: mutation.stableId,
          type: values.type,
          title: values.title,
          description: values.description,
          url: values.url ?? null,
          startsAt: values.startsAt ?? null,
          endsAt: values.endsAt ?? null,
          validFrom: values.validFrom ?? null,
          validTo: values.validTo ?? null,
          tags: values.tags ?? [],
          active: values.active ?? true,
        });
      }
      break;
    }
    case "WEIGHT": {
      const [answerStableId, moduleStableId] = mutation.stableId.split(":");
      const answer = snapshot.answers.find((item) => item.stableId === answerStableId);
      const careerModule = snapshot.modules.find(
        (item) => item.stableId === moduleStableId,
      );
      if (!answer || !careerModule) throw new Error("WEIGHT_REFERENCE_NOT_FOUND");
      const mapping = snapshot.mappings.find(
        (item) =>
          item.answerStableId === answerStableId &&
          item.moduleStableId === moduleStableId,
      );
      if (mapping) {
        mapping.weight = mutation.values.weight;
      } else {
        snapshot.mappings.push({
          answerStableId,
          questionStableId: answer.questionStableId,
          moduleStableId,
          weight: mutation.values.weight,
        });
      }
      break;
    }
    case "MAPPING_CREATE": {
      const { answer, careerModule } = mappingReferences(mutation.stableId, true);
      if (
        snapshot.mappings.some(
          (item) =>
            item.answerStableId === answer.stableId &&
            item.moduleStableId === careerModule.stableId,
        )
      ) {
        throw new Error("MAPPING_ALREADY_EXISTS");
      }
      snapshot.mappings.push({
        answerStableId: answer.stableId,
        questionStableId: answer.questionStableId,
        moduleStableId: careerModule.stableId,
        weight: mutation.values.weight,
      });
      break;
    }
    case "MAPPING_UPDATE": {
      const { answer, careerModule } = mappingReferences(mutation.stableId, true);
      const mapping = snapshot.mappings.find(
        (item) =>
          item.answerStableId === answer.stableId &&
          item.moduleStableId === careerModule.stableId,
      );
      if (!mapping) throw new Error("MAPPING_NOT_FOUND");
      mapping.weight = mutation.values.weight;
      break;
    }
    case "MAPPING_DELETE": {
      const { answer, careerModule } = mappingReferences(mutation.stableId, false);
      const index = snapshot.mappings.findIndex(
        (item) =>
          item.answerStableId === answer.stableId &&
          item.moduleStableId === careerModule.stableId,
      );
      if (index < 0) throw new Error("MAPPING_NOT_FOUND");
      snapshot.mappings.splice(index, 1);
      break;
    }
    case "MODULE_RECOMMENDATION_CREATE": {
      const { careerModule, recommendation } = moduleRecommendationReferences(
        mutation.stableId,
        true,
      );
      if (
        snapshot.moduleRecommendations.some(
          (item) =>
            item.moduleStableId === careerModule.stableId &&
            item.recommendationStableId === recommendation.stableId,
        )
      ) {
        throw new Error("MODULE_RECOMMENDATION_ALREADY_EXISTS");
      }
      snapshot.moduleRecommendations.push({
        moduleStableId: careerModule.stableId,
        recommendationStableId: recommendation.stableId,
        priority: mutation.values.priority,
      });
      break;
    }
    case "MODULE_RECOMMENDATION_UPDATE": {
      const { careerModule, recommendation } = moduleRecommendationReferences(
        mutation.stableId,
        true,
      );
      const link = snapshot.moduleRecommendations.find(
        (item) =>
          item.moduleStableId === careerModule.stableId &&
          item.recommendationStableId === recommendation.stableId,
      );
      if (!link) throw new Error("MODULE_RECOMMENDATION_NOT_FOUND");
      link.priority = mutation.values.priority;
      break;
    }
    case "MODULE_RECOMMENDATION_DELETE": {
      const { careerModule, recommendation } = moduleRecommendationReferences(
        mutation.stableId,
        false,
      );
      const index = snapshot.moduleRecommendations.findIndex(
        (item) =>
          item.moduleStableId === careerModule.stableId &&
          item.recommendationStableId === recommendation.stableId,
      );
      if (index < 0) throw new Error("MODULE_RECOMMENDATION_NOT_FOUND");
      snapshot.moduleRecommendations.splice(index, 1);
      break;
    }
    case "RULE": {
      Object.assign(
        required(snapshot.engineRules, mutation.stableId, "RULE_NOT_FOUND"),
        mutation.values,
      );
      break;
    }
    case "MODIFIER": {
      const modifier = required(
        snapshot.modifiers,
        mutation.stableId,
        "MODIFIER_NOT_FOUND",
      );
      if (mutation.values.effect !== undefined) {
        modifier.effect = mutation.values.effect as typeof modifier.effect;
      }
      if (mutation.values.operationParams !== undefined) {
        modifier.operation = {
          ...modifier.operation,
          params: mutation.values.operationParams,
        } as typeof modifier.operation;
      }
      if (mutation.values.active !== undefined) {
        modifier.active = mutation.values.active;
      }
      break;
    }
  }
  return validateCareerImport(snapshot);
}

export async function mutateCurrentDraft(input: {
  actorUserId: string;
  role: AdminRole;
  mutation: DraftMutation;
}) {
  const capability = [
    "WEIGHT",
    "MAPPING_CREATE",
    "MAPPING_UPDATE",
    "MAPPING_DELETE",
    "MODULE_RECOMMENDATION_CREATE",
    "MODULE_RECOMMENDATION_UPDATE",
    "MODULE_RECOMMENDATION_DELETE",
    "RULE",
    "MODIFIER",
  ].includes(input.mutation.entityType) ||
    (input.mutation.entityType === "MODULE" && input.mutation.values.sortOrder !== undefined)
    ? "LOGIC_EDIT"
    : "CONTENT_EDIT";
  requireCapability(input.role, capability);
  const draft = await getCurrentDraftConfig();
  try {
    assertExpectedRevision(draft.updatedAt, input.mutation.expectedUpdatedAt);
  } catch {
    throw new DraftConflictError();
  }
  const snapshot = applyDraftMutationToSnapshot(draft.snapshot, input.mutation);
  const validation = validateDraftCareerConfig(snapshot);
  if (!validation.valid) throw new Error("DRAFT_MUTATION_INVALID_CONFIG");
  const mappingOperation =
    input.mutation.entityType === "MAPPING_CREATE"
      ? "CREATE"
      : input.mutation.entityType === "MAPPING_UPDATE"
        ? "UPDATE"
        : input.mutation.entityType === "MAPPING_DELETE"
          ? "DELETE"
          : null;
  const moduleRecommendationOperation =
    input.mutation.entityType === "MODULE_RECOMMENDATION_CREATE"
      ? "CREATE"
      : input.mutation.entityType === "MODULE_RECOMMENDATION_UPDATE"
        ? "UPDATE"
        : input.mutation.entityType === "MODULE_RECOMMENDATION_DELETE"
          ? "DELETE"
          : null;
  const relationOperation = mappingOperation ?? moduleRecommendationOperation;
  const audit = {
    operation: relationOperation,
    changedFields: Object.keys(input.mutation.values),
    previous: snapshotEntityValues(draft.snapshot, input.mutation),
    next: relationOperation === "DELETE" ? null : input.mutation.values,
  };
  const { expectedUpdatedAt: _expectedUpdatedAt, ...compactMutation } =
    input.mutation;
  let result: Awaited<ReturnType<typeof adminDataApi.mutateDraft>>;
  try {
    result = await adminDataApi.mutateDraft({
      actorUserId: input.actorUserId,
      expectedUpdatedAt: input.mutation.expectedUpdatedAt,
      expectedSnapshotHash: draft.snapshotHash,
      mutation: compactMutation,
      audit,
    });
  } catch (error) {
    if (
      error instanceof AdminDataApiError &&
      error.message === "DRAFT_STALE_REVISION"
    ) {
      throw new DraftConflictError();
    }
    throw error;
  }
  return { ...result, validation };
}

function snapshotEntityValues(
  snapshot: ReturnType<typeof validateCareerImport>,
  mutation: DraftMutation,
) {
  if (
    mutation.entityType === "WEIGHT" ||
    mutation.entityType === "MAPPING_CREATE" ||
    mutation.entityType === "MAPPING_UPDATE" ||
    mutation.entityType === "MAPPING_DELETE"
  ) {
    const [answerStableId, moduleStableId] = mutation.stableId.split(":");
    const current = snapshot.mappings.find((item) => item.answerStableId === answerStableId && item.moduleStableId === moduleStableId);
    return current ? { weight: current.weight } : null;
  }
  if (
    mutation.entityType === "MODULE_RECOMMENDATION_CREATE" ||
    mutation.entityType === "MODULE_RECOMMENDATION_UPDATE" ||
    mutation.entityType === "MODULE_RECOMMENDATION_DELETE"
  ) {
    const [moduleStableId, recommendationStableId] = mutation.stableId.split(":");
    const current = snapshot.moduleRecommendations.find(
      (item) =>
        item.moduleStableId === moduleStableId &&
        item.recommendationStableId === recommendationStableId,
    );
    return current ? { priority: current.priority } : null;
  }
  if (
    mutation.entityType === "QUESTION_CREATE" ||
    mutation.entityType === "ANSWER_CREATE" ||
    mutation.entityType === "RECOMMENDATION_CREATE"
  ) return null;
  const collections = {
    QUESTION: snapshot.questions,
    ANSWER: snapshot.answers,
    MODULE: snapshot.modules,
    RECOMMENDATION: snapshot.recommendations,
    OPPORTUNITY: snapshot.opportunities,
    RULE: snapshot.engineRules,
    MODIFIER: snapshot.modifiers,
  } as const;
  const current = (collections[mutation.entityType] as ReadonlyArray<{ stableId: string }>).find((item) => item.stableId === mutation.stableId) as Record<string, unknown> | undefined;
  if (!current) return null;
  return Object.fromEntries(Object.keys(mutation.values).map((key) => [key, current[key] ?? null]));
}
