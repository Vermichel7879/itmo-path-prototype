import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateCareerImport } from "./import-model";

function validConfig() {
  return JSON.parse(
    readFileSync(resolve("src/lib/db/seed/career-config-v2.json"), "utf8"),
  );
}

describe("career import validation", () => {
  it("accepts the complete typed configuration", () => {
    const parsed = validateCareerImport(validConfig());
    expect(parsed.engineRules).toHaveLength(17);
    expect(parsed.documentationExamples).toHaveLength(7);
    expect(parsed.entrepreneurStages[0].answerStableId).toBe("Q9_A1");
    expect(parsed.entrepreneurChallenges[0].recommendationStableId).toBe(
      "GEN_ENT_CUSTOMER",
    );
  });

  it("rejects duplicate stable IDs", () => {
    const config = validConfig();
    config.answers.push({ ...config.answers[0] });
    expect(() => validateCareerImport(config)).toThrow(
      /дублирующийся ID.*Q1_A1/,
    );
  });

  it("rejects a mapping to a missing module", () => {
    const config = validConfig();
    config.mappings[0].moduleStableId = "M404";
    expect(() => validateCareerImport(config)).toThrow(/модуль M404 не найден/);
  });

  it("rejects invalid question constraints", () => {
    const config = validConfig();
    config.questions[1].minSelect = config.questions[1].maxSelect + 1;
    expect(() => validateCareerImport(config)).toThrow(
      /min_select не может быть больше max_select/,
    );
  });

  it("rejects an entrepreneurship answer outside the questionnaire", () => {
    const config = validConfig();
    config.entrepreneurStages[0].answerStableId = "Q9_A404";
    expect(() => validateCareerImport(config)).toThrow(
      /ответ Q9_A404 не найден/,
    );
  });

  it("rejects a broken stable reference inside typed rule params", () => {
    const config = validConfig();
    const guard = config.engineRules.find(
      (rule: { stableId: string }) => rule.stableId === "R13",
    );
    guard.params.allowPrimaryWhen.answerIds = ["Q1_A404"];
    expect(() => validateCareerImport(config)).toThrow(
      /answer Q1_A404 not found/,
    );
  });
});
