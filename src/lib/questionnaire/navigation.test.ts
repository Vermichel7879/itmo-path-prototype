import { describe, expect, it } from "vitest";
import { resolveQuestionnairePosition } from "./navigation";

describe("questionnaire navigation", () => {
  const orderedQuestions = [
    { id: "first" },
    { id: "second" },
    { id: "third" },
  ];

  it("starts a fresh session on the first ordered question", () => {
    expect(resolveQuestionnairePosition(orderedQuestions, null)).toEqual({
      index: 0,
      current: 1,
      total: 3,
    });
  });

  it("moves forward and back using the actual ordered sequence", () => {
    const first = resolveQuestionnairePosition(orderedQuestions, null);
    const secondId = orderedQuestions[first.index + 1].id;
    const second = resolveQuestionnairePosition(orderedQuestions, secondId);
    const firstId = orderedQuestions[second.index - 1].id;

    expect(second).toEqual({ index: 1, current: 2, total: 3 });
    expect(resolveQuestionnairePosition(orderedQuestions, firstId)).toEqual({
      index: 0,
      current: 1,
      total: 3,
    });
  });

  it("preserves a valid saved position for an existing session", () => {
    expect(resolveQuestionnairePosition(orderedQuestions, "third")).toEqual({
      index: 2,
      current: 3,
      total: 3,
    });
  });
});
