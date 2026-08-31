import { describe, expect, it } from "vitest";

import { machineRegressionFixtures } from "@/lib/db/config/__fixtures__/machine-regression-cases";
import seed from "@/lib/db/seed/career-config-v2.json";
import { validatePublishableCareerSnapshot } from "@/lib/db/publish/publish-validation";
import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";

import { validatePinnedEngineConfig } from "./engine-config";

const configVersionId = "00000000-0000-4000-8000-000000000123";

function engineArrays() {
  const full = validatePublishableCareerSnapshot(structuredClone(seed));
  return {
    full,
    compact: {
      questions: full.questions,
      answers: full.answers,
      mappings: full.mappings,
      modules: full.modules,
      modifiers: full.modifiers,
      recommendations: full.recommendations,
      moduleRecommendations: full.moduleRecommendations,
      opportunities: full.opportunities,
      entrepreneurStages: full.entrepreneurStages,
      entrepreneurChallenges: full.entrepreneurChallenges,
      engineRules: full.engineRules,
    },
  };
}

describe("pinned engine configuration", () => {
  it("passes existing publish validation and preserves Rule Engine output", () => {
    const { full, compact } = engineArrays();
    const pinned = validatePinnedEngineConfig({ configVersionId, config: compact });
    const fixture = machineRegressionFixtures[0];
    const overrides = { rankingScores: fixture.rankingScoresOverride };

    expect(pinned.configVersionId).toBe(configVersionId);
    expect(pinned.config.documentationExamples).toHaveLength(7);
    expect(compact).not.toHaveProperty("documentationExamples");
    expect(pinned.config.editingInstructions).toEqual([]);
    expect(calculateCareerTrajectoryDebug(
      configVersionId,
      pinned.config,
      fixture.selectedAnswerIds,
      overrides,
    )).toEqual(calculateCareerTrajectoryDebug(
      configVersionId,
      full,
      fixture.selectedAnswerIds,
      overrides,
    ));
  });

  it("rejects an engine payload that fails existing typed validation", () => {
    const { compact } = engineArrays();
    expect(() => validatePinnedEngineConfig({
      configVersionId,
      config: { ...compact, modules: [] },
    })).toThrow();
  });
});
