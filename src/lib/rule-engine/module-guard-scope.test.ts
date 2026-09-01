import { describe, expect, it } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";

import { calculateCareerTrajectoryDebug } from "./engine";

const scores = {
  M01: { total: 8, Q2: 0, Q3: 0, Q1: 8, Q5: 0 },
  M02: { total: 6, Q2: 0, Q3: 0, Q1: 6, Q5: 0 },
  M03: { total: 10, Q2: 0, Q3: 0, Q1: 10, Q5: 0 },
};

function configWithGuard(scope: "ALL_RANKING" | "PRIMARY_ONLY", moduleId = "M03") {
  const config = structuredClone(seed) as unknown as Record<string, unknown>;
  const engineRules = config.engineRules as Array<Record<string, unknown>>;
  engineRules.push({
    stableId: "R18",
    sourceTitle: "Extension guard",
    sourceContent: "Generic module primary eligibility guard.",
    sortOrder: 18,
    active: true,
    ruleKind: "MODULE_GUARD",
    params: {
      moduleId,
      allowPrimaryWhen: { kind: "ANY_ANSWER_ID", answerIds: ["Q1_A2"] },
      blockedPolicy: "REMOVE_FROM_PRIMARY_CANDIDATES",
      scope,
    },
  });
  return validateCareerImport(config);
}

describe("MODULE_GUARD scopes", () => {
  it("defaults existing R13/R14 guards to ALL_RANKING without changing their behavior", () => {
    const config = validateCareerImport(structuredClone(seed));
    expect(config.engineRules.filter((rule) => rule.ruleKind === "MODULE_GUARD"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ stableId: "R13", params: expect.objectContaining({ scope: "ALL_RANKING" }) }),
        expect.objectContaining({ stableId: "R14", params: expect.objectContaining({ scope: "ALL_RANKING" }) }),
      ]));
  });

  it("keeps a failed PRIMARY_ONLY module support-eligible but never primary", () => {
    const calculation = calculateCareerTrajectoryDebug("draft", configWithGuard("PRIMARY_ONLY"), ["Q1_A1"], {
      rankingScores: scores,
    });

    expect(calculation.result.primaryModule.id).toBe("M01");
    expect(calculation.result.supportModules.map((module) => module.id)).toContain("M03");
    expect(calculation.debug.guardEvaluations.find((guard) => guard.ruleId === "R18"))
      .toMatchObject({ passed: false, primaryEligible: false, supportEligible: true });
  });

  it("allows a passed PRIMARY_ONLY module to become primary", () => {
    const calculation = calculateCareerTrajectoryDebug("draft", configWithGuard("PRIMARY_ONLY"), ["Q1_A2"], {
      rankingScores: scores,
    });

    expect(calculation.result.primaryModule.id).toBe("M03");
  });

  it("removes a failed ALL_RANKING module from primary and support", () => {
    const calculation = calculateCareerTrajectoryDebug("draft", configWithGuard("ALL_RANKING"), ["Q1_A1"], {
      rankingScores: scores,
    });

    expect(calculation.result.primaryModule.id).not.toBe("M03");
    expect(calculation.result.supportModules.map((module) => module.id)).not.toContain("M03");
  });

  it("does not let tie-break return a failed PRIMARY_ONLY module as primary", () => {
    const tieScores = {
      M01: { total: 10, Q2: 3, Q3: 2, Q1: 2, Q5: 3 },
      M02: { total: 10, Q2: 3, Q3: 2, Q1: 2, Q5: 3 },
    };
    const calculation = calculateCareerTrajectoryDebug(
      "draft",
      configWithGuard("PRIMARY_ONLY", "M01"),
      ["Q1_A1"],
      { rankingScores: tieScores },
    );

    expect(calculation.result.primaryModule.id).toBe("M02");
    expect(calculation.result.supportModules.map((module) => module.id)).toContain("M01");
  });
});
