import { describe, expect, it } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";
import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";
import { buildAdminPreviewExplanation } from "./preview-debug";

function config() {
  return validateCareerImport(structuredClone(seed));
}

describe("admin result debugger", () => {
  it("presents actual score contributions and the engine tie-break order", () => {
    const current = config();
    const calculation = calculateCareerTrajectoryDebug("draft", current, ["Q5_A1", "Q5_A5"], {
      rankingScores: {
        M01: { total: 8, Q2: 3, Q3: 2, Q1: 1, Q5: 2 },
        M02: { total: 8, Q2: 3, Q3: 2, Q1: 1, Q5: 1 },
      },
    });
    const explanation = buildAdminPreviewExplanation(current, calculation);
    expect(explanation.scoreBreakdown.flatMap((item) => item.contributions)).toEqual(expect.arrayContaining(
      calculation.debug.scoreContributions.map((item) => expect.objectContaining(item)),
    ));
    expect(explanation.tieBreaks.find((item) => item.moduleIds.includes("M01") && item.moduleIds.includes("M02"))?.decidedBy).toBe("Q5");
  });

  it("explains fallback and module guards from the real debug result", () => {
    const current = config();
    const mapping = current.mappings.find((item) => item.answerStableId === "Q2_A1" && item.moduleStableId === "M09");
    if (mapping) mapping.weight = 10;
    else current.mappings.push({ answerStableId: "Q2_A1", questionStableId: "Q2", moduleStableId: "M09", weight: 10 });
    const guarded = calculateCareerTrajectoryDebug("draft", current, ["Q2_A1"]);
    expect(buildAdminPreviewExplanation(current, guarded).guards.find((item) => item.moduleId === "M09")?.excluded).toBe(true);

    const fallback = calculateCareerTrajectoryDebug("draft", config(), ["Q1_A1"]);
    const fallbackExplanation = buildAdminPreviewExplanation(config(), fallback);
    expect(fallbackExplanation.fallback).toMatchObject({ selectedModuleId: fallback.debug.primaryModuleId });
  });

  it("shows applied modifier triggers and recommendation sources", () => {
    const current = config();
    const calculation = calculateCareerTrajectoryDebug("draft", current, ["Q1_A1", "Q4_A1", "Q6_A2", "Q7_A2", "Q8_A1"]);
    const explanation = buildAdminPreviewExplanation(current, calculation);
    expect(explanation.modifiers.some((item) => item.id === "MOD01" && item.triggerAnswers.some((answer) => answer.id === "Q4_A1"))).toBe(true);
    expect(explanation.recommendations.length).toBe(calculation.result.recommendations.length);
    expect(explanation.recommendations.every((item) => ["PRIMARY", "SUPPORT", "SPECIAL"].includes(item.source))).toBe(true);
  });
});
