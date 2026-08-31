function assertQuestion(question) {
  if (!question || typeof question.id !== "string" || !Array.isArray(question.answers)) {
    throw new Error("INVALID_QUESTIONNAIRE_QUESTION");
  }
  if (!Number.isInteger(question.minSelect) || !Number.isInteger(question.maxSelect)) {
    throw new Error("INVALID_QUESTIONNAIRE_LIMITS");
  }
  if (question.minSelect < 0 || question.maxSelect < question.minSelect) {
    throw new Error("INVALID_QUESTIONNAIRE_LIMITS");
  }
}

function selectAnswers(question, seed) {
  assertQuestion(question);
  const requiredCount = question.required
    ? Math.max(1, question.minSelect)
    : question.minSelect;
  const count = question.type === "single"
    ? Math.min(requiredCount, 1)
    : requiredCount;
  if (count > question.maxSelect || count > question.answers.length) {
    throw new Error("QUESTIONNAIRE_HAS_NO_VALID_SELECTION");
  }
  if (count === 0) return [];

  const start = Math.abs(seed) % question.answers.length;
  return Array.from({ length: count }, (_, offset) =>
    question.answers[(start + offset) % question.answers.length].id,
  );
}

export function buildValidAnswerPlan(questionnaire, seed = 0) {
  if (
    !questionnaire ||
    questionnaire.educationLevel !== "MASTER" ||
    typeof questionnaire.configVersionId !== "string" ||
    !Array.isArray(questionnaire.questions)
  ) {
    throw new Error("INVALID_MASTER_QUESTIONNAIRE_DTO");
  }

  const baseQuestions = questionnaire.questions.filter(
    (question) => !question.entrepreneurshipOnly,
  );
  const basePlan = baseQuestions.map((question, index) => ({
    questionId: question.id,
    answerOptionIds: selectAnswers(question, seed + index),
  }));
  const selectedBaseIds = new Set(basePlan.flatMap((item) => item.answerOptionIds));
  const entrepreneurSignalSelected = baseQuestions.some((question) =>
    question.answers.some(
      (answer) => answer.entrepreneurSignal && selectedBaseIds.has(answer.id),
    ),
  );

  const branchPlan = entrepreneurSignalSelected
    ? questionnaire.questions
        .filter((question) => question.entrepreneurshipOnly)
        .map((question, index) => ({
          questionId: question.id,
          answerOptionIds: selectAnswers(
            question,
            seed + baseQuestions.length + index,
          ),
        }))
    : [];
  const byQuestionId = new Map(
    [...basePlan, ...branchPlan].map((item) => [item.questionId, item]),
  );

  return questionnaire.questions
    .filter(
      (question) => !question.entrepreneurshipOnly || entrepreneurSignalSelected,
    )
    .map((question) => byQuestionId.get(question.id));
}
