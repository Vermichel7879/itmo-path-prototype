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
  const snapshot = validateCareerImport(input);

  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (snapshot[key as keyof typeof expectedCounts].length !== expected) {
      throw new Error(`INITIAL_PUBLISH_VALIDATION_FAILED reason=${key.toUpperCase()}_COUNT`);
    }
  }

  const moduleOrder = [...snapshot.modules]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((module) => `${module.stableId}:${module.sortOrder}`);
  const expectedModuleOrder = Array.from(
    { length: 11 },
    (_, index) => `M${String(index + 1).padStart(2, "0")}:${index + 1}`,
  );
  if (moduleOrder.join(",") !== expectedModuleOrder.join(",")) {
    throw new Error("INITIAL_PUBLISH_VALIDATION_FAILED reason=MODULE_SORT_ORDER");
  }

  if (snapshot.modifiers.some((modifier) => !modifier.operation)) {
    throw new Error("INITIAL_PUBLISH_VALIDATION_FAILED reason=UNTYPED_MODIFIER");
  }

  return snapshot;
}
