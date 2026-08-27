import { describe, expect, it } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";
import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";

import { buildTrajectoryCompletionPayload } from "./persistence";

describe("trajectory result persistence payload", () => {
  it("contains normalized scores, contributions, selected modules, shown recommendations and snapshot", () => {
    const config = validateCareerImport(structuredClone(seed));
    const selected = ["Q1_A1", "Q2_A1", "Q3_A1", "Q4_A1", "Q5_A1", "Q6_A1", "Q7_A1", "Q8_A1"];
    const calculation = calculateCareerTrajectoryDebug("00000000-0000-4000-8000-000000000001", config, selected);
    const payload = buildTrajectoryCompletionPayload(config, selected, calculation);

    expect(payload.scores).toHaveLength(config.modules.length);
    expect(payload.scores[0]).toEqual(expect.objectContaining({ totalScore: expect.any(Number), finalRank: 1, q2Score: expect.any(Number), q3Score: expect.any(Number), q1Score: expect.any(Number), q5Score: expect.any(Number) }));
    expect(payload.contributions.every((item) => selected.includes(item.answerOptionId))).toBe(true);
    expect(payload.moduleResults[0]).toMatchObject({ kind: "PRIMARY", position: 1 });
    expect(payload.recommendations.map((item) => item.recommendationId)).toEqual(calculation.result.recommendations.map((item) => item.id));
    expect(payload.resultSnapshot).toEqual(calculation.result);
  });
});
