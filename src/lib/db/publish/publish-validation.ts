import type { CareerImport } from "../import/import-model";
import { validateCareerImport } from "../import/import-model";

const expectedCounts = {
  questions: 10,
  answers: 75,
  mappings: 52,
  modules: 11,
  recommendations: 22,
  moduleRecommendations: 51,
  modifiers: 12,
  entrepreneurStages: 5,
  entrepreneurChallenges: 8,
  engineRules: 17,
  documentationExamples: 7,
} as const;

export function validateInitialPublishSnapshot(input: unknown): CareerImport {
  const snapshot = validatePublishableCareerSnapshot(input);

  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (snapshot[key as keyof typeof expectedCounts].length !== expected) {
      throw new Error(`INITIAL_PUBLISH_VALIDATION_FAILED reason=${key.toUpperCase()}_COUNT`);
    }
  }

  return snapshot;
}

export function validatePublishableCareerSnapshot(input: unknown): CareerImport {
  const snapshot = validateCareerImport(input);
  if (
    new Set(snapshot.modules.map((module) => module.sortOrder)).size !==
    snapshot.modules.length
  ) {
    throw new Error("PUBLISH_VALIDATION_FAILED reason=MODULE_SORT_ORDER");
  }

  if (snapshot.modifiers.some((modifier) => !modifier.operation)) {
    throw new Error("INITIAL_PUBLISH_VALIDATION_FAILED reason=UNTYPED_MODIFIER");
  }

  return snapshot;
}
