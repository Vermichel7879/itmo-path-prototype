import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateInitialPublishSnapshot,
  validatePublishableCareerSnapshot,
} from "./publish-validation";

function seed() {
  return JSON.parse(
    readFileSync(resolve("src/lib/db/seed/career-config-v2.json"), "utf8"),
  );
}

describe("initial publish validation", () => {
  it("accepts the complete typed canonical snapshot", () => {
    const snapshot = validateInitialPublishSnapshot(seed());
    expect(snapshot.engineRules).toHaveLength(17);
    expect(snapshot.modifiers.every((modifier) => modifier.operation)).toBe(true);
  });

  it("rejects an incomplete rule set", () => {
    const snapshot = seed();
    snapshot.engineRules.pop();
    expect(() => validateInitialPublishSnapshot(snapshot)).toThrow(
      /R01-R17|ENGINE_RULES_COUNT/,
    );
  });

  it("rejects non-deterministic module ordering", () => {
    const snapshot = seed();
    snapshot.modules[0].sortOrder = 11;
    expect(() => validateInitialPublishSnapshot(snapshot)).toThrow(
      /MODULE_SORT_ORDER/,
    );
  });

  it("allows a typed MODULE_GUARD extension while retaining the core rules", () => {
    const snapshot = seed();
    snapshot.engineRules.push({
      stableId: "R18",
      sourceTitle: "Guard",
      sourceContent: "Extension guard",
      sortOrder: 18,
      active: true,
      ruleKind: "MODULE_GUARD",
      params: {
        moduleId: "M10",
        allowPrimaryWhen: { kind: "ANY_ANSWER_ID", answerIds: ["Q1_A6"] },
        blockedPolicy: "REMOVE_FROM_PRIMARY_CANDIDATES",
        scope: "PRIMARY_ONLY",
      },
    });

    expect(validatePublishableCareerSnapshot(snapshot).engineRules).toHaveLength(18);
  });
});
