import { describe, expect, it } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";
import { buildPublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";

import { filterCareerConfigByAudience } from "./audience";

function currentConfig() {
  return validateCareerImport(structuredClone(seed));
}

describe("career configuration audiences", () => {
  it("backfills the existing configuration as MASTER-only", () => {
    const config = currentConfig();
    expect(config.questions.every((item) => item.forMaster && !item.forBachelor)).toBe(true);
    expect(config.modules.every((item) => item.forMaster && !item.forBachelor)).toBe(true);
    expect(config.recommendations.every((item) => item.forMaster && !item.forBachelor)).toBe(true);
    expect(buildPublicQuestionnaireDTO("00000000-0000-4000-8000-000000000001", config, "MASTER").questions).toHaveLength(10);
  });

  it("does not expose MASTER-only content to BACHELOR", () => {
    const config = filterCareerConfigByAudience(currentConfig(), "BACHELOR");
    expect(config.questions).toHaveLength(0);
    expect(config.modules).toHaveLength(0);
    expect(config.recommendations).toHaveLength(0);
  });

  it("does not expose BACHELOR-only entities to MASTER", () => {
    const config = currentConfig();
    config.questions[0].forBachelor = true;
    config.questions[0].forMaster = false;
    config.modules[0].forBachelor = true;
    config.modules[0].forMaster = false;
    config.recommendations[0].forBachelor = true;
    config.recommendations[0].forMaster = false;
    const filtered = filterCareerConfigByAudience(config, "MASTER");
    expect(filtered.questions.some((item) => item.stableId === config.questions[0].stableId)).toBe(false);
    expect(filtered.modules.some((item) => item.stableId === config.modules[0].stableId)).toBe(false);
    expect(filtered.recommendations.some((item) => item.stableId === config.recommendations[0].stableId)).toBe(false);
  });

  it("rejects active entities without an audience and disjoint links", () => {
    const noAudience = structuredClone(seed);
    Object.assign(noAudience.questions[0], { forBachelor: false, forMaster: false });
    expect(() => validateCareerImport(noAudience)).toThrow(/аудитори/);

    const disjoint = structuredClone(seed);
    Object.assign(disjoint.questions[0], { forBachelor: true, forMaster: false });
    expect(() => validateCareerImport(disjoint)).toThrow(/не пересекаются/);
  });
});
