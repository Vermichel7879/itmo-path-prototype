import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateCareerImport } from "../import/import-model";
import { assembleCareerConfigSnapshot } from "./build-career-config-snapshot";
import { machineRegressionFixtures } from "./__fixtures__/machine-regression-cases";
import {
  APPROVED_TYPED_RULE_SOURCE_SHA256,
  createTypedEngineRules,
  engineRuleSchema,
  modifierOperationKindValues,
  ruleKindValues,
} from "./typed-rules";

function seed() {
  return validateCareerImport(
    JSON.parse(
      readFileSync(resolve("src/lib/db/seed/career-config-v2.json"), "utf8"),
    ),
  );
}

describe("typed rules configuration", () => {
  it("contains complete R01-R17 and E01-E07 collections", () => {
    const config = seed();
    expect(config.engineRules.map((rule) => rule.stableId)).toEqual(
      Array.from(
        { length: 17 },
        (_, index) => `R${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(config.documentationExamples.map((example) => example.stableId)).toEqual(
      Array.from(
        { length: 7 },
        (_, index) => `E${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });

  it("uses only declared discriminated rule kinds", () => {
    const kinds = new Set(seed().engineRules.map((rule) => rule.ruleKind));
    expect([...kinds].every((kind) => ruleKindValues.includes(kind))).toBe(true);
    expect(kinds).toContain("WEIGHTED_SCORING");
    expect(kinds).toContain("FALLBACK_SELECTION");
  });

  it("rejects params that do not match their rule kind", () => {
    const rule = structuredClone(seed().engineRules.find((item) => item.stableId === "R05")!);
    rule.params = { supportThreshold: "four" } as never;
    expect(() => engineRuleSchema.parse(rule)).toThrow();
  });

  it("creates every approved typed modifier operation", () => {
    const operations = seed().modifiers.map(
      (modifier) => modifier.operation.operationKind,
    );
    expect(new Set(operations)).toEqual(new Set(modifierOperationKindValues));
    expect(
      seed().modifiers.find((modifier) => modifier.stableId === "MOD01")?.operation,
    ).toMatchObject({
      operationKind: "REPLACE_STEP",
      params: { stepNumber: 3 },
    });
  });

  it("does not derive executable params from Russian source text", () => {
    const config = seed();
    const translated = createTypedEngineRules({
      sourceSha256: APPROVED_TYPED_RULE_SOURCE_SHA256,
      sourceRules: config.engineRules.map((rule) => ({
        id: rule.stableId,
        title: rule.sourceTitle,
        content: `Новый audit-текст ${rule.stableId}`,
      })),
      resultAssemblySections: config.engineRules.find(
        (rule) => rule.ruleKind === "RESULT_COMPOSITION",
      )!.params.sections,
    });
    expect(translated.map((rule) => rule.params)).toEqual(
      config.engineRules.map((rule) => rule.params),
    );
    expect(translated[0].sourceContent).toBe("Новый audit-текст R01");
  });

  it("rejects translation for an unapproved workbook revision", () => {
    const config = seed();
    expect(() =>
      createTypedEngineRules({
        sourceSha256: "A".repeat(64),
        sourceRules: config.engineRules.map((rule) => ({
          id: rule.stableId,
          title: rule.sourceTitle,
          content: rule.sourceContent,
        })),
        resultAssemblySections: config.engineRules.find(
          (rule) => rule.ruleKind === "RESULT_COMPOSITION",
        )!.params.sections,
      }),
    ).toThrow(/business rules changed/i);
  });

  it("assembles a publishable snapshot with typed rules and examples", () => {
    const snapshot = assembleCareerConfigSnapshot(seed());
    expect(snapshot.engineRules).toHaveLength(17);
    expect(snapshot.documentationExamples).toHaveLength(7);
    expect(snapshot.modifiers.every((modifier) => modifier.operation)).toBe(true);
  });

  it("keeps machine fixtures exact, referenced, and coverage-complete", () => {
    const config = seed();
    const answers = new Set(config.answers.map((answer) => answer.stableId));
    const modules = new Set(config.modules.map((module) => module.stableId));
    const modifiers = new Set(config.modifiers.map((modifier) => modifier.stableId));
    const allCoverage = new Set(machineRegressionFixtures.flatMap((item) => item.covers));

    expect(new Set(machineRegressionFixtures.map((item) => item.stableId)).size).toBe(
      machineRegressionFixtures.length,
    );
    for (const fixture of machineRegressionFixtures) {
      fixture.selectedAnswerIds.forEach((id) => expect(answers.has(id)).toBe(true));
      expect(modules.has(fixture.expectedPrimaryModuleId)).toBe(true);
      fixture.expectedSupportModuleIds.forEach((id) =>
        expect(modules.has(id)).toBe(true),
      );
      fixture.expectedModifierIds?.forEach((id) =>
        expect(modifiers.has(id)).toBe(true),
      );
    }

    [
      "normal-scoring",
      "q2-tie-break",
      "q3-tie-break",
      "q1-tie-break",
      "q5-tie-break",
      "module-sort-order-final-tie",
      "support-threshold-4",
      "support-below-4-rejected",
      "max-2-supports",
      "m09-guard",
      "m11-guard",
      "fallback-m01",
      "fallback-m02",
      "fallback-m10",
      "fallback-m11",
      "q6-priorities",
      "q7-pace",
      "q8-materials",
      "q8-individual",
      "q8-events",
      "q8-practice",
      "q8-default-mix",
      "entrepreneurship-branch-off",
      "entrepreneurship-branch-on",
      "two-q10-challenges",
      "hidden-q9-q10-ignored",
      "recommendation-dedupe",
    ].forEach((coverage) => expect(allCoverage.has(coverage)).toBe(true));
    for (let index = 1; index <= 6; index += 1) {
      expect(allCoverage.has(`modifier-mod${String(index).padStart(2, "0")}`)).toBe(
        true,
      );
    }
    for (const stage of ["interest", "idea", "validation", "users", "revenue"]) {
      expect(allCoverage.has(`q9-stage-${stage}`)).toBe(true);
    }
  });
});
