import { describe, expect, it } from "vitest";
import seed from "@/lib/db/seed/career-config-v2.json";
import { careerImportSchema } from "@/lib/db/import/import-model";
import { buildPublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import { canContinue, toggleQuestionAnswer } from "./answers";

const questionById = Object.fromEntries(
  buildPublicQuestionnaireDTO("test", careerImportSchema.parse(seed)).questions.map((question) => [question.id, question]),
);

describe("questionnaire answer rules", () => {
  it("does not add a fourth answer to Q2 after max-select", () => {
    const selected = ["Q2_A1", "Q2_A2", "Q2_A3"] as const;
    expect(toggleQuestionAnswer(questionById.Q2, [...selected], "Q2_A4")).toEqual(selected);
  });

  it("allows deselect after max-select and makes another option available", () => {
    const full = ["Q2_A1", "Q2_A2", "Q2_A3"] as const;
    const reduced = toggleQuestionAnswer(questionById.Q2, [...full], "Q2_A2");
    expect(reduced).toEqual(["Q2_A1", "Q2_A3"]);
    expect(toggleQuestionAnswer(questionById.Q2, reduced, "Q2_A4")).toEqual([
      "Q2_A1",
      "Q2_A3",
      "Q2_A4",
    ]);
  });

  it("allows optional Q4 and Q8 to continue without a selection", () => {
    expect(canContinue(questionById.Q4, [])).toBe(true);
    expect(canContinue(questionById.Q8, [])).toBe(true);
  });

  it("replaces a single selection without disabling alternatives", () => {
    expect(toggleQuestionAnswer(questionById.Q1, ["Q1_A1"], "Q1_A3")).toEqual(["Q1_A3"]);
  });
});
