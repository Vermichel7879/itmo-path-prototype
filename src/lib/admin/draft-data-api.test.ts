import { afterEach, describe, expect, it, vi } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";

vi.mock("server-only", () => ({}));

import {
  applyDraftMutationToSnapshot,
  draftMutationSchema,
  mutateCurrentDraft,
  type DraftMutation,
} from "./draft-service";
import { adminDataApi } from "./data-api";

const expectedUpdatedAt = "2026-08-24T12:00:00.000Z";

function currentConfig() {
  return validateCareerImport({ ...structuredClone(seed), opportunities: [] });
}

afterEach(() => vi.restoreAllMocks());

describe("canonical draft mutation", () => {
  it("updates the canonical typed snapshot without mutating the input", () => {
    const current = currentConfig();
    const originalText = current.questions[0].text;
    const mutation: DraftMutation = {
      entityType: "QUESTION",
      stableId: "Q1",
      expectedUpdatedAt,
      values: { text: "Updated question" },
    };

    const next = applyDraftMutationToSnapshot(current, mutation);

    expect(current.questions[0].text).toBe(originalText);
    expect(next.questions.find((question) => question.stableId === "Q1")?.text)
      .toBe("Updated question");
  });

  it("rejects a mutation that would break the typed configuration", () => {
    const mutation: DraftMutation = {
      entityType: "QUESTION",
      stableId: "Q1",
      expectedUpdatedAt,
      values: { minSelect: 2 },
    };

    expect(() => applyDraftMutationToSnapshot(currentConfig(), mutation))
      .toThrow();
  });

  it("changes audience only in the cloned DRAFT snapshot", () => {
    const current = currentConfig();
    const next = applyDraftMutationToSnapshot(current, {
      entityType: "QUESTION",
      stableId: "Q1",
      expectedUpdatedAt,
      values: { forBachelor: true, forMaster: true },
    });
    expect(current.questions[0].forBachelor).toBe(false);
    expect(next.questions[0]).toMatchObject({ forBachelor: true, forMaster: true });
  });

  it("never changes a separate PUBLISHED snapshot while preparing a DRAFT mutation", () => {
    const published = currentConfig();
    const publishedBefore = structuredClone(published);
    applyDraftMutationToSnapshot(currentConfig(), {
      entityType: "QUESTION",
      stableId: "Q1",
      expectedUpdatedAt,
      values: { text: "DRAFT only" },
    });
    expect(published).toEqual(publishedBefore);
  });

  it("creates, updates, and deletes only the selected mapping", () => {
    const current = currentConfig();
    const stableId = "Q4_A1:M01";
    const created = applyDraftMutationToSnapshot(current, {
      entityType: "MAPPING_CREATE",
      stableId,
      expectedUpdatedAt,
      values: { weight: 7 },
    });
    expect(created.mappings).toContainEqual({
      answerStableId: "Q4_A1",
      questionStableId: "Q4",
      moduleStableId: "M01",
      weight: 7,
    });
    expect(current.mappings).not.toContainEqual(expect.objectContaining({ answerStableId: "Q4_A1" }));

    const updated = applyDraftMutationToSnapshot(created, {
      entityType: "MAPPING_UPDATE",
      stableId,
      expectedUpdatedAt,
      values: { weight: -3 },
    });
    expect(updated.mappings.find((mapping) => `${mapping.answerStableId}:${mapping.moduleStableId}` === stableId)?.weight).toBe(-3);

    const deleted = applyDraftMutationToSnapshot(updated, {
      entityType: "MAPPING_DELETE",
      stableId,
      expectedUpdatedAt,
      values: {},
    });
    expect(deleted.mappings).toHaveLength(current.mappings.length);
    expect(deleted.answers.find((answer) => answer.stableId === "Q4_A1")).toEqual(
      current.answers.find((answer) => answer.stableId === "Q4_A1"),
    );
    expect(deleted.modules.find((module) => module.stableId === "M01")).toEqual(
      current.modules.find((module) => module.stableId === "M01"),
    );
  });

  it("allows an answer to have no mappings", () => {
    const current = currentConfig();
    const onlyMapping = current.mappings[0];
    current.mappings = [onlyMapping];
    const next = applyDraftMutationToSnapshot(current, {
      entityType: "MAPPING_DELETE",
      stableId: `${onlyMapping.answerStableId}:${onlyMapping.moduleStableId}`,
      expectedUpdatedAt,
      values: {},
    });
    expect(next.mappings).toEqual([]);
  });

  it("rejects duplicate mappings and missing references", () => {
    const current = currentConfig();
    const mapping = current.mappings[0];
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MAPPING_CREATE",
      stableId: `${mapping.answerStableId}:${mapping.moduleStableId}`,
      expectedUpdatedAt,
      values: { weight: 1 },
    })).toThrow("MAPPING_ALREADY_EXISTS");
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MAPPING_CREATE",
      stableId: "Q404_A1:M01",
      expectedUpdatedAt,
      values: { weight: 1 },
    })).toThrow("ANSWER_NOT_FOUND");
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MAPPING_CREATE",
      stableId: "Q4_A1:M404",
      expectedUpdatedAt,
      values: { weight: 1 },
    })).toThrow("MODULE_NOT_FOUND");
  });

  it("rejects an audience mismatch", () => {
    const current = currentConfig();
    const question = current.questions.find((item) => item.stableId === "Q4");
    const careerModule = current.modules.find((item) => item.stableId === "M01");
    expect(question).toBeDefined();
    expect(careerModule).toBeDefined();
    Object.assign(question!, {
      forBachelor: true,
      forMaster: false,
    });
    Object.assign(careerModule!, {
      forBachelor: false,
      forMaster: true,
    });
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MAPPING_CREATE",
      stableId: "Q4_A1:M01",
      expectedUpdatedAt,
      values: { weight: 1 },
    })).toThrow("MAPPING_AUDIENCE_INCOMPATIBLE");
  });

  it("enforces the existing integer weight range", () => {
    expect(draftMutationSchema.safeParse({
      entityType: "MAPPING_CREATE",
      stableId: "Q4_A1:M01",
      expectedUpdatedAt,
      values: { weight: -10 },
    }).success).toBe(true);
    expect(draftMutationSchema.safeParse({
      entityType: "MAPPING_CREATE",
      stableId: "Q4_A1:M01",
      expectedUpdatedAt,
      values: { weight: 1.5 },
    }).success).toBe(false);
    expect(draftMutationSchema.safeParse({
      entityType: "MAPPING_CREATE",
      stableId: "Q4_A1:M01",
      expectedUpdatedAt,
      values: { weight: 11 },
    }).success).toBe(false);
  });
});

describe("mapping mutation orchestration", () => {
  const draftId = "00000000-0000-4000-8000-000000000003";
  const actorUserId = "00000000-0000-4000-8000-000000000001";

  function mockDraft(snapshot = currentConfig()) {
    vi.spyOn(adminDataApi, "getDraft").mockResolvedValue({
      id: draftId,
      updatedAt: expectedUpdatedAt,
      snapshotHash: "a".repeat(64),
      snapshot,
    });
    return vi.spyOn(adminDataApi, "mutateDraft").mockResolvedValue({
      id: draftId,
      updatedAt: "2026-08-24T12:01:00.000Z",
    });
  }

  it("allows ADMIN and sends synchronized normalized/snapshot create with audit", async () => {
    const mutateMapping = mockDraft();
    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "MAPPING_CREATE",
        stableId: "Q4_A1:M01",
        expectedUpdatedAt,
        values: { weight: 7 },
      },
    });
    expect(mutateMapping).toHaveBeenCalledWith(expect.objectContaining({
      mutation: {
        entityType: "MAPPING_CREATE",
        stableId: "Q4_A1:M01",
        values: { weight: 7 },
      },
      audit: {
        operation: "CREATE",
        changedFields: ["weight"],
        previous: null,
        next: { weight: 7 },
      },
    }));
  });

  it("sends previous/next audit for update and previous/next=null for delete", async () => {
    const current = currentConfig();
    const mapping = current.mappings[0];
    const stableId = `${mapping.answerStableId}:${mapping.moduleStableId}`;
    const mutateMapping = mockDraft(current);

    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "MAPPING_UPDATE",
        stableId,
        expectedUpdatedAt,
        values: { weight: mapping.weight + 1 },
      },
    });
    expect(mutateMapping).toHaveBeenLastCalledWith(expect.objectContaining({
      mutation: expect.objectContaining({ entityType: "MAPPING_UPDATE" }),
      audit: {
        operation: "UPDATE",
        changedFields: ["weight"],
        previous: { weight: mapping.weight },
        next: { weight: mapping.weight + 1 },
      },
    }));

    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "MAPPING_DELETE",
        stableId,
        expectedUpdatedAt,
        values: {},
      },
    });
    expect(mutateMapping).toHaveBeenLastCalledWith(expect.objectContaining({
      mutation: expect.objectContaining({ entityType: "MAPPING_DELETE" }),
      audit: {
        operation: "DELETE",
        changedFields: [],
        previous: { weight: mapping.weight },
        next: null,
      },
    }));
  });

  it("denies EDITOR before any Data API mutation", async () => {
    const mutateMapping = vi.spyOn(adminDataApi, "mutateDraft");
    await expect(mutateCurrentDraft({
      actorUserId,
      role: "EDITOR",
      mutation: {
        entityType: "MAPPING_DELETE",
        stableId: "Q1_A1:M01",
        expectedUpdatedAt,
        values: {},
      },
    })).rejects.toThrow("ADMIN_FORBIDDEN");
    expect(mutateMapping).not.toHaveBeenCalled();
  });
});

describe("draft revision flow", () => {
  const draftId = "00000000-0000-4000-8000-000000000003";
  const actorUserId = "00000000-0000-4000-8000-000000000001";
  const firstRevision = "2026-08-25T10:44:46.00859+00:00";
  const secondRevision = "2026-08-25T10:45:01.123456+00:00";
  const thirdRevision = "2026-08-25T10:45:02.654321+00:00";

  function draftAt(updatedAt: string) {
    return {
      id: draftId,
      updatedAt,
      snapshotHash: "a".repeat(64),
      snapshot: currentConfig(),
    };
  }

  it("accepts a fresh GET revision and then the revision returned by the first save", async () => {
    let currentRevision = firstRevision;
    vi.spyOn(adminDataApi, "getDraft").mockImplementation(async () => draftAt(currentRevision));
    const mutateDraft = vi.spyOn(adminDataApi, "mutateDraft").mockImplementation(async (input) => {
      expect(input.expectedUpdatedAt).toBe(currentRevision);
      currentRevision = currentRevision === firstRevision ? secondRevision : thirdRevision;
      return { id: draftId, updatedAt: currentRevision };
    });

    const firstSave = await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "QUESTION",
        stableId: "Q1",
        expectedUpdatedAt: firstRevision,
        values: { text: "Первое сохранение" },
      },
    });
    expect(firstSave.updatedAt).toBe(secondRevision);

    const secondSave = await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "QUESTION",
        stableId: "Q1",
        expectedUpdatedAt: firstSave.updatedAt,
        values: { text: "Второе сохранение" },
      },
    });
    expect(secondSave.updatedAt).toBe(thirdRevision);
    expect(mutateDraft).toHaveBeenCalledTimes(2);
  });

  it("rejects the revision loaded before a concurrent mutation", async () => {
    vi.spyOn(adminDataApi, "getDraft").mockResolvedValue(draftAt(secondRevision));
    const mutateDraft = vi.spyOn(adminDataApi, "mutateDraft");

    await expect(mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "ANSWER",
        stableId: "Q1_A1",
        expectedUpdatedAt: firstRevision,
        values: { text: "Устаревшее сохранение" },
      },
    })).rejects.toThrow("DRAFT_STALE_REVISION");
    expect(mutateDraft).not.toHaveBeenCalled();
  });
});

describe("compact entity mutation payloads", () => {
  const draftId = "00000000-0000-4000-8000-000000000003";
  const actorUserId = "00000000-0000-4000-8000-000000000001";

  it.each([
    {
      entityType: "ANSWER" as const,
      stableId: "Q1_A1",
      values: { text: "Обновлённый ответ" },
    },
    {
      entityType: "MODULE" as const,
      stableId: "M01",
      values: { name: "Обновлённый модуль" },
    },
  ])("sends $entityType without a full snapshot", async (mutation) => {
    vi.spyOn(adminDataApi, "getDraft").mockResolvedValue({
      id: draftId,
      updatedAt: expectedUpdatedAt,
      snapshotHash: "a".repeat(64),
      snapshot: currentConfig(),
    });
    const mutateDraft = vi.spyOn(adminDataApi, "mutateDraft").mockResolvedValue({
      id: draftId,
      updatedAt: "2026-08-24T12:01:00.000Z",
    });

    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: { ...mutation, expectedUpdatedAt },
    });

    expect(mutateDraft).toHaveBeenCalledWith(expect.objectContaining({
      mutation,
    }));
    expect(mutateDraft.mock.calls[0][0]).not.toHaveProperty("nextSnapshot");
  });
});

describe("module recommendation mutations", () => {
  const draftId = "00000000-0000-4000-8000-000000000003";
  const actorUserId = "00000000-0000-4000-8000-000000000001";
  const linkStableId = "M01:CKO_RESUME";

  function mockDraft(snapshot = currentConfig()) {
    vi.spyOn(adminDataApi, "getDraft").mockResolvedValue({
      id: draftId,
      updatedAt: expectedUpdatedAt,
      snapshotHash: "a".repeat(64),
      snapshot,
    });
    return vi.spyOn(adminDataApi, "mutateDraft").mockResolvedValue({
      id: draftId,
      updatedAt: "2026-08-24T12:01:00.000Z",
    });
  }

  it("creates, updates, and deletes only the selected link", () => {
    const current = currentConfig();
    const created = applyDraftMutationToSnapshot(current, {
      entityType: "MODULE_RECOMMENDATION_CREATE",
      stableId: linkStableId,
      expectedUpdatedAt,
      values: { priority: 7 },
    });
    expect(created.moduleRecommendations).toContainEqual({
      moduleStableId: "M01",
      recommendationStableId: "CKO_RESUME",
      priority: 7,
    });
    expect(current.moduleRecommendations).not.toContainEqual(
      expect.objectContaining({ moduleStableId: "M01", recommendationStableId: "CKO_RESUME" }),
    );

    const updated = applyDraftMutationToSnapshot(created, {
      entityType: "MODULE_RECOMMENDATION_UPDATE",
      stableId: linkStableId,
      expectedUpdatedAt,
      values: { priority: 3 },
    });
    expect(updated.moduleRecommendations.find(
      (link) => `${link.moduleStableId}:${link.recommendationStableId}` === linkStableId,
    )?.priority).toBe(3);

    const deleted = applyDraftMutationToSnapshot(updated, {
      entityType: "MODULE_RECOMMENDATION_DELETE",
      stableId: linkStableId,
      expectedUpdatedAt,
      values: {},
    });
    expect(deleted.moduleRecommendations).toHaveLength(current.moduleRecommendations.length);
    expect(deleted.modules.find((item) => item.stableId === "M01")).toEqual(
      current.modules.find((item) => item.stableId === "M01"),
    );
    expect(deleted.recommendations.find((item) => item.stableId === "CKO_RESUME")).toEqual(
      current.recommendations.find((item) => item.stableId === "CKO_RESUME"),
    );
  });

  it("rejects duplicate links, invalid priority, and missing references", () => {
    const current = currentConfig();
    const existing = current.moduleRecommendations[0];
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MODULE_RECOMMENDATION_CREATE",
      stableId: `${existing.moduleStableId}:${existing.recommendationStableId}`,
      expectedUpdatedAt,
      values: { priority: 1 },
    })).toThrow("MODULE_RECOMMENDATION_ALREADY_EXISTS");
    expect(draftMutationSchema.safeParse({
      entityType: "MODULE_RECOMMENDATION_CREATE",
      stableId: linkStableId,
      expectedUpdatedAt,
      values: { priority: 0 },
    }).success).toBe(false);
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MODULE_RECOMMENDATION_CREATE",
      stableId: "M404:CKO_RESUME",
      expectedUpdatedAt,
      values: { priority: 1 },
    })).toThrow("MODULE_NOT_FOUND");
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MODULE_RECOMMENDATION_CREATE",
      stableId: "M01:REC404",
      expectedUpdatedAt,
      values: { priority: 1 },
    })).toThrow("RECOMMENDATION_NOT_FOUND");
  });

  it("rejects an audience mismatch", () => {
    const current = currentConfig();
    const careerModule = current.modules.find((item) => item.stableId === "M01");
    const recommendation = current.recommendations.find((item) => item.stableId === "CKO_RESUME");
    expect(careerModule).toBeDefined();
    expect(recommendation).toBeDefined();
    Object.assign(careerModule!, { forBachelor: true, forMaster: false });
    Object.assign(recommendation!, { forBachelor: false, forMaster: true });
    expect(() => applyDraftMutationToSnapshot(current, {
      entityType: "MODULE_RECOMMENDATION_CREATE",
      stableId: linkStableId,
      expectedUpdatedAt,
      values: { priority: 1 },
    })).toThrow("MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE");
  });

  it("allows ADMIN and sends synchronized snapshot plus create audit", async () => {
    const mutateLink = mockDraft();
    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "MODULE_RECOMMENDATION_CREATE",
        stableId: linkStableId,
        expectedUpdatedAt,
        values: { priority: 7 },
      },
    });
    expect(mutateLink).toHaveBeenCalledWith(expect.objectContaining({
      mutation: {
        entityType: "MODULE_RECOMMENDATION_CREATE",
        stableId: linkStableId,
        values: { priority: 7 },
      },
      audit: {
        operation: "CREATE",
        changedFields: ["priority"],
        previous: null,
        next: { priority: 7 },
      },
    }));
  });

  it("records update and delete audit metadata", async () => {
    const current = currentConfig();
    const existing = current.moduleRecommendations[0];
    const stableId = `${existing.moduleStableId}:${existing.recommendationStableId}`;
    const mutateLink = mockDraft(current);

    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "MODULE_RECOMMENDATION_UPDATE",
        stableId,
        expectedUpdatedAt,
        values: { priority: existing.priority + 1 },
      },
    });
    expect(mutateLink).toHaveBeenLastCalledWith(expect.objectContaining({
      mutation: expect.objectContaining({ entityType: "MODULE_RECOMMENDATION_UPDATE" }),
      audit: {
        operation: "UPDATE",
        changedFields: ["priority"],
        previous: { priority: existing.priority },
        next: { priority: existing.priority + 1 },
      },
    }));

    await mutateCurrentDraft({
      actorUserId,
      role: "ADMIN",
      mutation: {
        entityType: "MODULE_RECOMMENDATION_DELETE",
        stableId,
        expectedUpdatedAt,
        values: {},
      },
    });
    expect(mutateLink).toHaveBeenLastCalledWith(expect.objectContaining({
      mutation: expect.objectContaining({ entityType: "MODULE_RECOMMENDATION_DELETE" }),
      audit: {
        operation: "DELETE",
        changedFields: [],
        previous: { priority: existing.priority },
        next: null,
      },
    }));
  });

  it("denies EDITOR before any Data API mutation", async () => {
    const mutateLink = vi.spyOn(adminDataApi, "mutateDraft");
    await expect(mutateCurrentDraft({
      actorUserId,
      role: "EDITOR",
      mutation: {
        entityType: "MODULE_RECOMMENDATION_DELETE",
        stableId: "M01:CKO_CONSULT",
        expectedUpdatedAt,
        values: {},
      },
    })).rejects.toThrow("ADMIN_FORBIDDEN");
    expect(mutateLink).not.toHaveBeenCalled();
  });
});
