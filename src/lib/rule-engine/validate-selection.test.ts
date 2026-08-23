import { describe, expect, it } from "vitest";

import seed from "../db/seed/career-config-v2.json";
import { careerImportSchema } from "../db/import/import-model";
import { calculateCareerTrajectoryDebug } from "./engine";
import {
  QuestionnaireValidationError,
  trajectoryRequestSchema,
  validateQuestionnaireSelection,
} from "./validate-selection";

const config = careerImportSchema.parse(seed);
const baseAnswers = ["Q1_A1", "Q2_A1", "Q3_A1", "Q5_A1", "Q6_A1", "Q7_A1"];

function validationCode(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof QuestionnaireValidationError ? error.code : "OTHER";
  }
}

describe("server questionnaire validation", () => {
  it("rejects a malformed or wrong-shaped config version", () => {
    expect(trajectoryRequestSchema.safeParse({ configVersionId: "wrong-version", selectedAnswerIds: [] }).success).toBe(false);
  });

  it("rejects an unknown answer", () => {
    expect(validationCode(() => validateQuestionnaireSelection(config, [...baseAnswers, "Q1_BAD"]))).toBe("UNKNOWN_ANSWER_ID");
  });

  it("rejects max_select violations", () => {
    expect(validationCode(() => validateQuestionnaireSelection(config, [
      ...baseAnswers.filter((id) => id !== "Q2_A1"),
      "Q2_A1", "Q2_A2", "Q2_A3", "Q2_A4",
    ]))).toBe("MAX_SELECT");
  });

  it("rejects a missing required answer", () => {
    expect(validationCode(() => validateQuestionnaireSelection(config, baseAnswers.filter((id) => id !== "Q7_A1")))).toBe("MIN_SELECT");
  });

  it("ignores hidden Q9/Q10 answers when the branch is inactive", () => {
    const selection = validateQuestionnaireSelection(config, [...baseAnswers, "Q9_A5", "Q10_A7"]);
    expect(selection.activeBranch).toBe(false);
    expect(selection.ignoredAnswerIds).toEqual(["Q9_A5", "Q10_A7"]);
    expect(selection.effectiveAnswerIds).toEqual(baseAnswers);
  });

  it("requires and keeps Q9/Q10 when entrepreneurship is active", () => {
    const active = [...baseAnswers, "Q4_A6", "Q9_A2", "Q10_A3"];
    const selection = validateQuestionnaireSelection(config, active);
    expect(selection.activeBranch).toBe(true);
    expect(selection.effectiveAnswerIds).toEqual(active);
  });
});

describe("engine safety policies", () => {
  it("keeps result version consistent with the requested published version", () => {
    const versionId = "0699b9e9-790e-4909-b84c-946ee3d70233";
    expect(calculateCareerTrajectoryDebug(versionId, config, baseAnswers).result.configVersionId).toBe(versionId);
  });

  it("rejects unresolved same-step modifier conflicts", () => {
    const conflictingConfig = structuredClone(config);
    const modifier = conflictingConfig.modifiers.find((item) => item.stableId === "MOD04");
    if (!modifier || modifier.operation.operationKind !== "REPLACE_STEP") throw new Error("Fixture modifier missing");
    modifier.operation.params.stepNumber = 3;
    expect(() => calculateCareerTrajectoryDebug("version", conflictingConfig, ["Q2_A4", "Q4_A3", "Q4_A4"])).toThrow("conflicting_step_modifiers");
  });

  it("deduplicates recommendations and excludes slots without opportunities", () => {
    const { result } = calculateCareerTrajectoryDebug("version", config, ["Q1_A6", "Q2_A2", "Q3_A4", "Q5_A5"]);
    expect(new Set(result.recommendations.map((item) => item.id)).size).toBe(result.recommendations.length);
    expect(result.recommendations.every((item) => !["EVENT", "CLUB", "FACULTY"].includes(item.type))).toBe(true);
  });
});
