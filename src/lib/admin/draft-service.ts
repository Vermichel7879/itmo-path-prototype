import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireCapability, type AdminRole } from "@/lib/auth/permissions";
import { getDatabase } from "@/lib/db/client";
import { buildCareerConfigSnapshot } from "@/lib/db/config/build-career-config-snapshot";
import { readDraftSnapshotChunks } from "@/lib/db/config/snapshot-reader";
import type { CareerDatabaseExecutor } from "@/lib/db/connection";
import { validateCareerImport } from "@/lib/db/import/import-model";
import {
  answers,
  answerModuleWeights,
  auditLog,
  configVersions,
  engineRules,
  modifiers,
  modules,
  opportunities,
  questions,
  recommendations,
} from "@/lib/db/schema";

import { validateDraftCareerConfig } from "./validation";
import { assertExpectedRevision } from "./concurrency";

const timestampToken = z.iso.datetime({ offset: true });
const stableId = z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,99}$/);

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
    stableId: z.string().regex(/^[A-Z0-9_]+:[A-Z0-9_]+$/),
    expectedUpdatedAt: timestampToken,
    values: z.object({ weight: z.number().int().min(-10).max(10) }).strict(),
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

async function currentDraft(db: CareerDatabaseExecutor) {
  const [draft] = await db
    .select({ id: configVersions.id, updatedAt: configVersions.updatedAt })
    .from(configVersions)
    .where(eq(configVersions.status, "DRAFT"))
    .limit(1);
  if (!draft) throw new Error("DRAFT_CONFIG_MISSING");
  return draft;
}

export async function getCurrentDraftConfig() {
  const db = getDatabase();
  const draft = await currentDraft(db);
  const snapshot = validateCareerImport(await readDraftSnapshotChunks(db, draft.id));
  return {
    id: draft.id,
    updatedAt: draft.updatedAt.toISOString(),
    snapshot,
    validation: validateDraftCareerConfig(snapshot),
  };
}

async function applyMutation(
  tx: CareerDatabaseExecutor,
  draftId: string,
  mutation: DraftMutation,
) {
  const updatedAt = new Date();
  const whereStable = (column: typeof questions.stableId) =>
    and(eq(column, mutation.stableId), eq(questions.configVersionId, draftId));
  switch (mutation.entityType) {
    case "QUESTION_CREATE": {
      if (!mutation.values.firstAnswer.stableId.startsWith(`${mutation.stableId}_A`)) throw new Error("ANSWER_ID_QUESTION_MISMATCH");
      const [createdQuestion] = await tx.insert(questions).values({
        configVersionId: draftId,
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
      }).returning({ id: questions.id });
      await tx.insert(answers).values({
        configVersionId: draftId,
        questionId: createdQuestion.id,
        stableId: mutation.values.firstAnswer.stableId,
        text: mutation.values.firstAnswer.text,
        sortOrder: 1,
        tags: [],
        keys: [],
        active: true,
      });
      break;
    }
    case "ANSWER_CREATE": {
      if (!mutation.stableId.startsWith(`${mutation.values.questionStableId}_A`)) throw new Error("ANSWER_ID_QUESTION_MISMATCH");
      const [question] = await tx.select({ id: questions.id }).from(questions).where(and(eq(questions.configVersionId, draftId), eq(questions.stableId, mutation.values.questionStableId))).limit(1);
      if (!question) throw new Error("QUESTION_NOT_FOUND");
      await tx.insert(answers).values({
        configVersionId: draftId,
        questionId: question.id,
        stableId: mutation.stableId,
        text: mutation.values.text,
        sortOrder: mutation.values.sortOrder,
        tags: mutation.values.tags,
        keys: mutation.values.keys,
        active: mutation.values.active,
      });
      break;
    }
    case "RECOMMENDATION_CREATE":
      await tx.insert(recommendations).values({ configVersionId: draftId, stableId: mutation.stableId, ...mutation.values });
      break;
    case "QUESTION":
      await tx.update(questions).set({ ...mutation.values, updatedAt }).where(whereStable(questions.stableId));
      break;
    case "ANSWER":
      await tx.update(answers).set({ ...mutation.values, updatedAt }).where(and(eq(answers.stableId, mutation.stableId), eq(answers.configVersionId, draftId)));
      break;
    case "MODULE":
      await tx.update(modules).set({ ...mutation.values, updatedAt }).where(and(eq(modules.stableId, mutation.stableId), eq(modules.configVersionId, draftId)));
      break;
    case "RECOMMENDATION":
      await tx.update(recommendations).set({ ...mutation.values, updatedAt }).where(and(eq(recommendations.stableId, mutation.stableId), eq(recommendations.configVersionId, draftId)));
      break;
    case "OPPORTUNITY": {
      const dateValues = Object.fromEntries(Object.entries(mutation.values).map(([key, value]) => [key, key.endsWith("At") || key === "validFrom" || key === "validTo" ? (typeof value === "string" ? new Date(value) : value) : value]));
      const updated = await tx.update(opportunities).set({ ...dateValues, updatedAt }).where(and(eq(opportunities.stableId, mutation.stableId), eq(opportunities.configVersionId, draftId))).returning({ id: opportunities.id });
      if (!updated.length) {
        const values = mutation.values;
        if (!values.type || !values.title || !values.description) throw new Error("OPPORTUNITY_CREATE_FIELDS_REQUIRED");
        await tx.insert(opportunities).values({
          configVersionId: draftId,
          stableId: mutation.stableId,
          type: values.type,
          title: values.title,
          description: values.description,
          url: values.url ?? null,
          startsAt: values.startsAt ? new Date(values.startsAt) : null,
          endsAt: values.endsAt ? new Date(values.endsAt) : null,
          validFrom: values.validFrom ? new Date(values.validFrom) : null,
          validTo: values.validTo ? new Date(values.validTo) : null,
          tags: values.tags ?? [],
          active: values.active ?? true,
        });
      }
      break;
    }
    case "WEIGHT": {
      const [answerStableId, moduleStableId] = mutation.stableId.split(":");
      const [answer] = await tx.select({ id: answers.id }).from(answers).where(and(eq(answers.configVersionId, draftId), eq(answers.stableId, answerStableId))).limit(1);
      const [module] = await tx.select({ id: modules.id }).from(modules).where(and(eq(modules.configVersionId, draftId), eq(modules.stableId, moduleStableId))).limit(1);
      if (!answer || !module) throw new Error("WEIGHT_REFERENCE_NOT_FOUND");
      await tx.insert(answerModuleWeights).values({ configVersionId: draftId, answerId: answer.id, moduleId: module.id, weight: mutation.values.weight }).onConflictDoUpdate({ target: [answerModuleWeights.configVersionId, answerModuleWeights.answerId, answerModuleWeights.moduleId], set: { weight: mutation.values.weight } });
      break;
    }
    case "RULE":
      await tx.update(engineRules).set({
        ...mutation.values,
        params: mutation.values.params as typeof engineRules.$inferInsert.params,
        updatedAt,
      }).where(and(eq(engineRules.stableId, mutation.stableId), eq(engineRules.configVersionId, draftId)));
      break;
    case "MODIFIER":
      await tx.update(modifiers).set({
        ...mutation.values,
        effect: mutation.values.effect as typeof modifiers.$inferInsert.effect,
        operationParams: mutation.values.operationParams as typeof modifiers.$inferInsert.operationParams,
        updatedAt,
      }).where(and(eq(modifiers.stableId, mutation.stableId), eq(modifiers.configVersionId, draftId)));
      break;
  }
}

export async function mutateCurrentDraft(input: {
  actorUserId: string;
  role: AdminRole;
  mutation: DraftMutation;
}) {
  const capability = ["WEIGHT", "RULE", "MODIFIER"].includes(input.mutation.entityType) ||
    (input.mutation.entityType === "MODULE" && input.mutation.values.sortOrder !== undefined)
    ? "LOGIC_EDIT"
    : "CONTENT_EDIT";
  requireCapability(input.role, capability);
  return getDatabase().transaction(async (tx) => {
    const draft = await currentDraft(tx);
    try {
      assertExpectedRevision(draft.updatedAt, input.mutation.expectedUpdatedAt);
    } catch {
      throw new DraftConflictError();
    }
    const locked = await tx.execute<Record<string, unknown>>(sql`
      select updated_at as "updatedAt"
      from config_versions
      where id = ${draft.id}::uuid and status = 'DRAFT'
      for update
    `);
    const lockedRevision = locked[0]?.updatedAt;
    if (!lockedRevision || new Date(String(lockedRevision)).toISOString() !== input.mutation.expectedUpdatedAt) {
      throw new DraftConflictError();
    }
    const previousSnapshot = validateCareerImport(await readDraftSnapshotChunks(tx, draft.id));
    await applyMutation(tx, draft.id, input.mutation);
    const snapshot = await buildCareerConfigSnapshot(tx, draft.id);
    const validation = validateDraftCareerConfig(snapshot);
    if (!validation.valid) throw new Error("DRAFT_MUTATION_INVALID_CONFIG");
    const now = new Date();
    await tx.update(configVersions).set({ snapshot, updatedAt: now }).where(eq(configVersions.id, draft.id));
    await tx.insert(auditLog).values({
      actorAdminUserId: input.actorUserId,
      configVersionId: draft.id,
      action: "DRAFT_ENTITY_UPDATED",
      entityType: input.mutation.entityType,
      entityId: input.mutation.stableId,
      metadata: {
        changedFields: Object.keys(input.mutation.values),
        previous: snapshotEntityValues(previousSnapshot, input.mutation),
        next: input.mutation.values,
      },
    });
    return { id: draft.id, updatedAt: now.toISOString(), validation };
  });
}

function snapshotEntityValues(
  snapshot: ReturnType<typeof validateCareerImport>,
  mutation: DraftMutation,
) {
  if (mutation.entityType === "WEIGHT") {
    const [answerStableId, moduleStableId] = mutation.stableId.split(":");
    const current = snapshot.mappings.find((item) => item.answerStableId === answerStableId && item.moduleStableId === moduleStableId);
    return current ? { weight: current.weight } : null;
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
