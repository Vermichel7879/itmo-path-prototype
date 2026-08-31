import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readPinnedPublicQuestionnaire } from "./questionnaire-read";

describe("compact public questionnaire read", () => {
  it("builds a questionnaire DTO from one compact normalized read", async () => {
    const getPinnedQuestionnaireData = vi.fn().mockResolvedValue({
        configVersionId: "00000000-0000-4000-8000-000000000123",
        educationLevel: "MASTER",
        branchQuestionIds: ["Q9", "Q10"],
        signalTag: "entrepreneur_signal",
        questions: [{
          id: "Q1",
          block: "Старт",
          title: "Вопрос",
          selectionType: "SINGLE",
          minSelect: 1,
          maxSelect: 1,
          required: true,
          answers: [{ id: "Q1_A1", text: "Ответ", tags: ["entrepreneur_signal"] }],
        }],
    });

    await expect(readPinnedPublicQuestionnaire(
      "00000000-0000-4000-8000-000000000123",
      "MASTER",
      { getPinnedQuestionnaireData },
    )).resolves.toMatchObject({
      questionnaire: {
        configVersionId: "00000000-0000-4000-8000-000000000123",
        educationLevel: "MASTER",
        questions: [{
          id: "Q1",
          answers: [{ id: "Q1_A1", entrepreneurSignal: true }],
        }],
      },
    });
    expect(getPinnedQuestionnaireData).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000123",
      "MASTER",
    );
  });

  it("returns unavailable when the exact pinned version is missing", async () => {
    const getPinnedQuestionnaireData = vi.fn().mockResolvedValue(null);
    await expect(readPinnedPublicQuestionnaire(
      "00000000-0000-4000-8000-000000000123",
      "MASTER",
      { getPinnedQuestionnaireData },
    )).resolves.toMatchObject({ questionnaire: null });
  });

  it("passes the session-pinned config version into the compact reader", () => {
    const route = readFileSync(resolve("src/app/api/questionnaire/route.ts"), "utf8");
    expect(route).toContain("const effectiveVersion = session?.configVersionId ?? requestedVersion");
    expect(route).toContain("readPinnedPublicQuestionnaire(\n      effectiveVersion");
    expect(route).not.toContain("getLatestPublishedCareerConfig");
    expect(route).not.toContain("getPublishedCareerConfigById");
  });
});
