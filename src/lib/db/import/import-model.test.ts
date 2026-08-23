import { describe, expect, it } from "vitest";

import { validateCareerImport } from "./import-model";

function validConfig() {
  return {
    source: {
      fileName: "fixture.xlsx",
      sha256: "A".repeat(64),
      workbookVersion: "v-test",
      recognizedSheets: ["fixture"],
      readme: {},
    },
    questions: [
      {
        stableId: "Q9",
        block: "stage",
        text: "Stage?",
        selectionType: "SINGLE" as const,
        minSelect: 1,
        maxSelect: 1,
        required: true,
        sortOrder: 1,
        showCondition: { expression: "entrepreneur_signal = true" },
        active: true,
      },
      {
        stableId: "Q10",
        block: "challenge",
        text: "Challenge?",
        selectionType: "MULTI" as const,
        minSelect: 1,
        maxSelect: 1,
        required: true,
        sortOrder: 2,
        showCondition: { expression: "entrepreneur_signal = true" },
        active: true,
      },
    ],
    answers: [
      {
        stableId: "Q9_A1",
        questionStableId: "Q9",
        text: "Idea",
        sortOrder: 1,
        tags: [],
        keys: [],
        active: true,
      },
      {
        stableId: "Q10_A1",
        questionStableId: "Q10",
        text: "Demand",
        sortOrder: 1,
        tags: [],
        keys: [],
        active: true,
      },
    ],
    mappings: [
      {
        answerStableId: "Q9_A1",
        questionStableId: "Q9",
        moduleStableId: "M11",
        weight: 4,
      },
    ],
    modules: [
      {
        stableId: "M11",
        name: "Entrepreneurship",
        goal: "Validate an idea",
        steps: ["One", "Two", "Three"] as [string, string, string],
        checkpoint: "Evidence",
        recommendationStableIds: ["REC1"],
        constraints: "",
        active: true,
      },
    ],
    modifiers: [],
    recommendations: [
      {
        stableId: "REC1",
        type: "GENERAL" as const,
        title: "Interview",
        description: "Talk to users",
        url: null,
        status: "ACTIVE" as const,
        tags: [],
        active: true,
      },
    ],
    moduleRecommendations: [
      { moduleStableId: "M11", recommendationStableId: "REC1", priority: 1 },
    ],
    entrepreneurStages: [
      {
        stableId: "ent_stage_idea",
        answerStableId: "Q9_A1",
        targetModuleStableId: "M11",
        answerText: "Idea",
        focus: "Validation",
        steps: ["One", "Two", "Three"] as [string, string, string],
        checkpoint: "Evidence",
        sortOrder: 1,
        active: true,
      },
    ],
    entrepreneurChallenges: [
      {
        stableId: "ent_demand",
        answerStableId: "Q10_A1",
        targetModuleStableId: "M11",
        answerText: "Demand",
        trajectoryAdjustment: "Run a test",
        recommendationStableId: "REC1",
        sortOrder: 1,
        active: true,
      },
    ],
    rules: [],
    examples: [],
    editingInstructions: [],
  };
}

describe("career import validation", () => {
  it("accepts valid entrepreneurship references", () => {
    const parsed = validateCareerImport(validConfig());
    expect(parsed.entrepreneurStages[0].answerStableId).toBe("Q9_A1");
    expect(parsed.entrepreneurChallenges[0].recommendationStableId).toBe("REC1");
  });

  it("rejects duplicate stable IDs", () => {
    const config = validConfig();
    config.answers.push({ ...config.answers[0] });
    expect(() => validateCareerImport(config)).toThrow(/дублирующийся ID.*Q9_A1/);
  });

  it("rejects a mapping to a missing module", () => {
    const config = validConfig();
    config.mappings[0].moduleStableId = "M404";
    expect(() => validateCareerImport(config)).toThrow(/модуль M404 не найден/);
  });

  it("rejects invalid question constraints", () => {
    const config = validConfig();
    config.questions[1].minSelect = 2;
    expect(() => validateCareerImport(config)).toThrow(
      /min_select не может быть больше max_select/,
    );
  });

  it("rejects an entrepreneurship answer outside the questionnaire", () => {
    const config = validConfig();
    config.entrepreneurStages[0].answerStableId = "Q9_A404";
    expect(() => validateCareerImport(config)).toThrow(/ответ Q9_A404 не найден/);
  });
});
