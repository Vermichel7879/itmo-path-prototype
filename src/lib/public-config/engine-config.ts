import { z } from "zod";

import { engineRuleSchema } from "@/lib/db/config/typed-rules";
import {
  answerImportSchema,
  entrepreneurChallengeImportSchema,
  entrepreneurStageImportSchema,
  mappingImportSchema,
  modifierImportSchema,
  moduleImportSchema,
  moduleRecommendationImportSchema,
  opportunityImportSchema,
  questionImportSchema,
  recommendationImportSchema,
} from "@/lib/db/import/import-model";
import { validatePublishableCareerSnapshot } from "@/lib/db/publish/publish-validation";

const engineConfigArraysSchema = z
  .object({
    questions: z.array(questionImportSchema),
    answers: z.array(answerImportSchema),
    mappings: z.array(mappingImportSchema),
    modules: z.array(moduleImportSchema),
    modifiers: z.array(modifierImportSchema),
    recommendations: z.array(recommendationImportSchema),
    moduleRecommendations: z.array(moduleRecommendationImportSchema),
    opportunities: z.array(opportunityImportSchema),
    entrepreneurStages: z.array(entrepreneurStageImportSchema),
    entrepreneurChallenges: z.array(entrepreneurChallengeImportSchema),
    engineRules: z.array(engineRuleSchema),
  })
  .strict();

export const pinnedEngineConfigRpcSchema = z
  .object({
    configVersionId: z.uuid(),
    config: engineConfigArraysSchema,
  })
  .nullable();

export type PinnedEngineConfigRpc = z.infer<typeof pinnedEngineConfigRpcSchema>;

const validationOnlyDocumentationExamples = Array.from(
  { length: 7 },
  (_, index) => ({
    stableId: `E0${index + 1}`,
    inputSummary: "Not included in the public engine payload",
    expectedModuleSummary: "Not included in the public engine payload",
    primaryFocus: "Not included in the public engine payload",
    stepsSummary: "Not included in the public engine payload",
    recommendationsSummary: "Not included in the public engine payload",
    sortOrder: index + 1,
    active: false,
  }),
);

export function validatePinnedEngineConfig(input: NonNullable<PinnedEngineConfigRpc>) {
  return {
    configVersionId: input.configVersionId,
    config: validatePublishableCareerSnapshot({
      source: {
        fileName: "pinned-engine-config",
        sha256: "0".repeat(64),
        workbookVersion: "pinned-engine-config",
        recognizedSheets: ["pinned-engine-config"],
        readme: {},
      },
      ...input.config,
      documentationExamples: validationOnlyDocumentationExamples,
      editingInstructions: [],
    }),
  };
}
