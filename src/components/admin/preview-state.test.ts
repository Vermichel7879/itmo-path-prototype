import { describe, expect, it } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validateCareerImport } from "@/lib/db/import/import-model";
import { buildPublicQuestionnaireDTO, type PublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import {
  canCalculatePreview,
  previewRadioGroupName,
  reconcilePreviewAnswers,
  updatePreviewAnswer,
  visiblePreviewQuestions,
} from "./preview-state";

const questionnaire: PublicQuestionnaireDTO = {
  configVersionId: "draft",
  educationLevel: "MASTER",
  questions: [
    { id: "Q1", block: "A", title: "Single 1", instruction: "", type: "single", minSelect: 1, maxSelect: 1, required: true, entrepreneurshipOnly: false, answers: [{ id: "Q1_A1", text: "A", entrepreneurSignal: false }, { id: "Q1_A2", text: "B", entrepreneurSignal: false }] },
    { id: "Q2", block: "A", title: "Single 2", instruction: "", type: "single", minSelect: 1, maxSelect: 1, required: true, entrepreneurshipOnly: false, answers: [{ id: "Q2_A1", text: "C", entrepreneurSignal: true }] },
    { id: "Q3", block: "A", title: "Multi", instruction: "", type: "multi", minSelect: 1, maxSelect: 2, required: true, entrepreneurshipOnly: false, answers: [{ id: "Q3_A1", text: "D", entrepreneurSignal: false }, { id: "Q3_A2", text: "E", entrepreneurSignal: false }, { id: "Q3_A3", text: "F", entrepreneurSignal: false }] },
    { id: "Q9", block: "B", title: "Conditional", instruction: "", type: "single", minSelect: 1, maxSelect: 1, required: true, entrepreneurshipOnly: true, answers: [{ id: "Q9_A1", text: "G", entrepreneurSignal: false }] },
  ],
};

describe("admin DRAFT Preview state", () => {
  it("uses separate SINGLE groups and enforces MULTI maxSelect", () => {
    expect(previewRadioGroupName("Q1")).not.toBe(previewRadioGroupName("Q2"));
    let answers = updatePreviewAnswer(questionnaire, {}, questionnaire.questions[2], "Q3_A1");
    answers = updatePreviewAnswer(questionnaire, answers, questionnaire.questions[2], "Q3_A2");
    answers = updatePreviewAnswer(questionnaire, answers, questionnaire.questions[2], "Q3_A3");
    expect(answers.Q3).toEqual(["Q3_A1", "Q3_A2"]);
  });

  it("shows conditional questions only for the signal and clears their hidden answers", () => {
    expect(visiblePreviewQuestions(questionnaire, {}).map((item) => item.id)).not.toContain("Q9");
    const branchAnswers = { Q2: ["Q2_A1"], Q9: ["Q9_A1"] };
    expect(visiblePreviewQuestions(questionnaire, branchAnswers).map((item) => item.id)).toContain("Q9");
    expect(reconcilePreviewAnswers(questionnaire, { Q9: ["Q9_A1"] }).Q9).toBeUndefined();
  });

  it("accounts for minSelect before calculation", () => {
    expect(canCalculatePreview(questionnaire, {})).toBe(false);
    expect(canCalculatePreview(questionnaire, { Q1: ["Q1_A1"], Q2: ["Q2_A1"], Q3: ["Q3_A1"], Q9: ["Q9_A1"] })).toBe(true);
  });

  it("uses the production DTO builder for active and audience filtering", () => {
    const config = validateCareerImport(structuredClone(seed));
    config.questions[0].active = false;
    const inactiveAnswer = config.answers.find((answer) => answer.questionStableId !== config.questions[0].stableId)!;
    inactiveAnswer.active = false;
    const master = buildPublicQuestionnaireDTO("draft", config, "MASTER");
    expect(master.questions.length).toBeGreaterThan(0);
    expect(master.questions.some((item) => item.id === config.questions[0].stableId)).toBe(false);
    expect(master.questions.flatMap((item) => item.answers).some((item) => item.id === inactiveAnswer.stableId)).toBe(false);
    config.questions.forEach((item) => { item.forBachelor = false; });
    config.modules.forEach((item) => { item.forBachelor = false; });
    config.recommendations.forEach((item) => { item.forBachelor = false; });
    expect(buildPublicQuestionnaireDTO("draft", config, "BACHELOR").questions).toHaveLength(0);
  });
});
