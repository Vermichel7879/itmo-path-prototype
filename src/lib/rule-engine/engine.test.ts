import { describe, expect, it } from "vitest";

import seed from "../db/seed/career-config-v2.json";
import { machineRegressionFixtures } from "../db/config/__fixtures__/machine-regression-cases";
import { careerImportSchema, type CareerImport } from "../db/import/import-model";
import { calculateCareerTrajectoryDebug } from "./engine";

function configForFixture(
  fixture: (typeof machineRegressionFixtures)[number],
): CareerImport {
  const config = structuredClone(seed);
  for (const override of fixture.mappingWeightOverrides ?? []) {
    const mapping = config.mappings.find(
      (candidate) =>
        candidate.answerStableId === override.answerId &&
        candidate.moduleStableId === override.moduleId,
    );
    if (mapping) {
      mapping.weight = override.weight;
    } else {
      const answer = config.answers.find(
        (candidate) => candidate.stableId === override.answerId,
      );
      if (!answer) throw new Error(`Unknown fixture answer ${override.answerId}`);
      config.mappings.push({
        answerStableId: override.answerId,
        questionStableId: answer.questionStableId,
        moduleStableId: override.moduleId,
        weight: override.weight,
      });
    }
  }
  return careerImportSchema.parse(config);
}

describe("published career rule engine — T01–T31", () => {
  for (const fixture of machineRegressionFixtures) {
    it(`${fixture.stableId}: ${fixture.covers.join(", ")}`, () => {
      const calculation = calculateCareerTrajectoryDebug(
        "00000000-0000-4000-8000-000000000001",
        configForFixture(fixture),
        fixture.selectedAnswerIds,
        { rankingScores: fixture.rankingScoresOverride },
      );

      expect(calculation.result.primaryModule.id).toBe(
        fixture.expectedPrimaryModuleId,
      );
      expect(calculation.result.supportModules.map((module) => module.id)).toEqual(
        fixture.expectedSupportModuleIds,
      );
      if (fixture.expectedModifierIds) {
        expect(calculation.debug.appliedModifierIds).toEqual(
          expect.arrayContaining(fixture.expectedModifierIds),
        );
      }
      if (fixture.expectedPaceKey) {
        expect(calculation.result.pace?.key).toBe(fixture.expectedPaceKey);
      }
      if (fixture.expectedEntrepreneurStageId) {
        expect(calculation.result.entrepreneurship.stage?.id).toBe(
          fixture.expectedEntrepreneurStageId,
        );
      }
      if (fixture.expectedEntrepreneurChallengeIds) {
        expect(calculation.debug.entrepreneurChallengeIds).toEqual(
          fixture.expectedEntrepreneurChallengeIds,
        );
      }
      if (fixture.expectedIgnoredAnswerIds) {
        expect(calculation.debug.ignoredAnswerIds).toEqual(
          fixture.expectedIgnoredAnswerIds,
        );
      }
      expect(new Set(calculation.result.recommendations.map((item) => item.id)).size).toBe(
        calculation.result.recommendations.length,
      );
    });
  }
});
