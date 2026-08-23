import { describe, expect, it } from "vitest";
import { calculateMockTrajectory, getQuestionSequence, hasEntrepreneurSignal } from ".";
import type { CareerAnswers } from "@/types/career";

describe("mock rule engine", () => {
  it("reproduces the E02 module order from the Excel examples", () => {
    const answers: CareerAnswers = {
      Q1: ["Q1_A3"],
      Q2: ["Q2_A3", "Q2_A8"],
      Q3: ["Q3_A2"],
      Q5: ["Q5_A1"],
      Q6: ["Q6_A2", "Q6_A5"],
      Q7: ["Q7_A2"],
    };

    const result = calculateMockTrajectory(answers);

    expect(result.primary.id).toBe("M02");
    expect(result.supports.map((module) => module.id)).toEqual(["M05", "M08"]);
    expect(result.recommendations.map((recommendation) => recommendation.id)).toEqual([
      "CKO_DIGEST",
      "EVENT",
      "GEN_SEARCH_TRACKER",
    ]);
  });

  it("reveals entrepreneurship and uses the stage-specific trajectory", () => {
    const answers: CareerAnswers = {
      Q1: ["Q1_A7"],
      Q2: ["Q2_A14"],
      Q3: ["Q3_A12"],
      Q5: ["Q5_A4"],
      Q6: ["Q6_A7"],
      Q7: ["Q7_A2"],
      Q9: ["Q9_A2"],
      Q10: ["Q10_A3"],
    };

    const result = calculateMockTrajectory(answers);

    expect(hasEntrepreneurSignal(answers)).toBe(true);
    expect(getQuestionSequence(true)).toHaveLength(10);
    expect(result.primary.id).toBe("M11");
    expect(result.steps[0]).toContain("Сформулировать пользователя");
    expect(result.steps[2]).toContain("минимальный тест");
  });

  it("keeps the public sequence at eight questions without a signal", () => {
    const answers: CareerAnswers = { Q1: ["Q1_A2"], Q5: ["Q5_A1"] };
    expect(hasEntrepreneurSignal(answers)).toBe(false);
    expect(getQuestionSequence(false).map((question) => question.id)).toEqual([
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "Q5",
      "Q6",
      "Q7",
      "Q8",
    ]);
  });
});
