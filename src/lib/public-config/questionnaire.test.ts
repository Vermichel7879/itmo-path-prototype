import { describe, expect, it } from "vitest";

import seed from "../db/seed/career-config-v2.json";
import { careerImportSchema } from "../db/import/import-model";
import { buildPublicQuestionnaireDTO } from "./questionnaire";

const config = careerImportSchema.parse(seed);

describe("public questionnaire DTO", () => {
  it("exposes versioned questionnaire copy and safe branch metadata only", () => {
    const dto = buildPublicQuestionnaireDTO("published-version", config);
    expect(dto.configVersionId).toBe("published-version");
    expect(dto.questions).toHaveLength(10);
    expect(dto.questions.filter((question) => question.entrepreneurshipOnly).map((q) => q.id)).toEqual([
      "Q9",
      "Q10",
    ]);
    expect(dto.questions.find((question) => question.id === "Q4")?.answers.find((answer) => answer.id === "Q4_A6")?.entrepreneurSignal).toBe(true);
    expect(JSON.stringify(dto)).not.toMatch(/weight|engineRule|modifier|recommendation/i);
  });
});
