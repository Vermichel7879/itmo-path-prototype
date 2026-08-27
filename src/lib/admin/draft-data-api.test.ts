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
    return vi.spyOn(adminDataApi, "mutateMapping").mockResolvedValue({
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
      operation: "CREATE",
      answerStableId: "Q4_A1",
      moduleStableId: "M01",
      weight: 7,
      nextSnapshot: expect.objectContaining({
        mappings: expect.arrayContaining([expect.objectContaining({
          answerStableId: "Q4_A1",
          moduleStableId: "M01",
          weight: 7,
        })]),
      }),
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
      operation: "UPDATE",
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
      operation: "DELETE",
      weight: null,
      audit: {
        operation: "DELETE",
        changedFields: [],
        previous: { weight: mapping.weight },
        next: null,
      },
    }));
  });

  it("denies EDITOR before any Data API mutation", async () => {
    const mutateMapping = vi.spyOn(adminDataApi, "mutateMapping");
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
