import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { machineRegressionFixtures } from "../src/lib/db/config/__fixtures__/machine-regression-cases";
import { validateCareerImport } from "../src/lib/db/import/import-model";
import seed from "../src/lib/db/seed/career-config-v2.json";
import { prepareTrajectoryPdfData } from "../src/lib/pdf/trajectory-pdf-data";
import { calculateCareerTrajectoryDebug } from "../src/lib/rule-engine/engine";
import { renderTrajectoryPdfSample } from "./render-trajectory-pdf-sample";

const publishedVersionId = "0699b9e9-790e-4909-b84c-946ee3d70233";

const scenarios = [
  { fixture: "T31", name: "m01-two-support" },
  { fixture: "T01", name: "m02-search" },
  { fixture: "T15", name: "m05-resume" },
  { fixture: "T12", name: "m10-study-development" },
  { fixture: "T27", name: "m11-entrepreneurship" },
] as const;

function scenarioConfig(fixtureId: string) {
  const config = validateCareerImport(structuredClone(seed));
  const fixture = machineRegressionFixtures.find(
    (item) => item.stableId === fixtureId,
  );
  if (!fixture) throw new Error(`Fixture not found: ${fixtureId}`);
  for (const override of fixture.mappingWeightOverrides ?? []) {
    const mapping = config.mappings.find(
      (item) =>
        item.answerStableId === override.answerId &&
        item.moduleStableId === override.moduleId,
    );
    if (mapping) {
      mapping.weight = override.weight;
    } else {
      const answer = config.answers.find(
        (item) => item.stableId === override.answerId,
      );
      if (!answer) throw new Error(`Answer not found: ${override.answerId}`);
      config.mappings.push({
        answerStableId: override.answerId,
        questionStableId: answer.questionStableId,
        moduleStableId: override.moduleId,
        weight: override.weight,
      });
    }
  }
  return { config, fixture };
}

export async function generateTrajectoryPdfSamples() {
  const directory = resolve("tmp", "pdfs");
  await mkdir(directory, { recursive: true });
  for (const scenario of scenarios) {
    const { config, fixture } = scenarioConfig(scenario.fixture);
    const calculation = calculateCareerTrajectoryDebug(
      publishedVersionId,
      config,
      fixture.selectedAnswerIds,
      { rankingScores: fixture.rankingScoresOverride },
    );
    if (calculation.result.primaryModule.id !== fixture.expectedPrimaryModuleId) {
      throw new Error(`Unexpected primary module for ${scenario.fixture}`);
    }
    const data = await prepareTrajectoryPdfData(calculation.result);
    const output = resolve(directory, `trajectory-${scenario.name}.pdf`);
    await writeFile(output, await renderTrajectoryPdfSample(data));
    console.log(
      `PDF_SAMPLE=${scenario.name} PRIMARY=${data.primaryModule.id} SUPPORT=${data.supportModules.length} LINKS=${data.resources.filter((item) => item.href).length}`,
    );
  }
}
