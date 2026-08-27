import { describe, expect, it, vi } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";

vi.mock("server-only", () => ({}));

import {
  applyDraftMutationToSnapshot,
  type DraftMutation,
} from "./draft-service";

const expectedUpdatedAt = "2026-08-24T12:00:00.000Z";

function currentConfig() {
  return validateCareerImport({ ...structuredClone(seed), opportunities: [] });
}

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
});
