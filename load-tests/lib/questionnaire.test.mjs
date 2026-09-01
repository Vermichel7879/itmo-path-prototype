import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProgressiveAnswerBatches,
  buildValidAnswerPlan,
} from "./questionnaire.mjs";

function questionnaire({ signalFirst = false } = {}) {
  return {
    configVersionId: "00000000-0000-4000-8000-000000000001",
    educationLevel: "MASTER",
    questions: [
      {
        id: "Q1",
        type: "single",
        minSelect: 1,
        maxSelect: 1,
        required: true,
        entrepreneurshipOnly: false,
        answers: [
          { id: "Q1_A1", entrepreneurSignal: signalFirst },
          { id: "Q1_A2", entrepreneurSignal: false },
        ],
      },
      {
        id: "Q2",
        type: "multi",
        minSelect: 2,
        maxSelect: 3,
        required: true,
        entrepreneurshipOnly: false,
        answers: [
          { id: "Q2_A1", entrepreneurSignal: false },
          { id: "Q2_A2", entrepreneurSignal: false },
          { id: "Q2_A3", entrepreneurSignal: false },
        ],
      },
      {
        id: "Q9",
        type: "single",
        minSelect: 1,
        maxSelect: 1,
        required: true,
        entrepreneurshipOnly: true,
        answers: [{ id: "Q9_A1", entrepreneurSignal: false }],
      },
    ],
  };
}

test("builds a valid base questionnaire plan without hidden branch answers", () => {
  const plan = buildValidAnswerPlan(questionnaire(), 0);
  assert.deepEqual(plan, [
    { questionId: "Q1", answerOptionIds: ["Q1_A1"] },
    { questionId: "Q2", answerOptionIds: ["Q2_A2", "Q2_A3"] },
  ]);
});

test("adds entrepreneurship-only questions when the selected DTO answer signals it", () => {
  const plan = buildValidAnswerPlan(questionnaire({ signalFirst: true }), 0);
  assert.deepEqual(plan.map((item) => item.questionId), ["Q1", "Q2", "Q9"]);
});

test("rejects a non-MASTER questionnaire", () => {
  assert.throws(
    () => buildValidAnswerPlan({ ...questionnaire(), educationLevel: "BACHELOR" }),
    /INVALID_MASTER_QUESTIONNAIRE_DTO/,
  );
});

test("builds progressive full-set payloads in groups of three", () => {
  const plan = Array.from({ length: 8 }, (_, index) => ({
    questionId: `Q${index + 1}`,
    answerOptionIds: [`Q${index + 1}_A1`],
  }));
  const batches = buildProgressiveAnswerBatches(plan);

  assert.equal(batches.length, 3);
  assert.deepEqual(batches.map((batch) => batch.length), [3, 6, 8]);
  assert.deepEqual(batches.at(-1), plan);
  assert.equal(buildProgressiveAnswerBatches([...plan, ...plan.slice(0, 2)]).length, 4);
});
