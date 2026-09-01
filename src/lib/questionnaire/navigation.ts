interface OrderedQuestion {
  id: string;
}

export interface QuestionnairePosition {
  index: number;
  current: number;
  total: number;
}

export function resolveQuestionnairePosition(
  questions: readonly OrderedQuestion[],
  currentQuestionId: string | null,
): QuestionnairePosition {
  const savedIndex = currentQuestionId
    ? questions.findIndex((question) => question.id === currentQuestionId)
    : -1;
  const index = questions.length === 0 ? -1 : Math.max(0, savedIndex);

  return {
    index,
    current: index < 0 ? 0 : index + 1,
    total: questions.length,
  };
}
