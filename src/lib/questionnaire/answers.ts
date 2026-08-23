interface QuestionnaireSelectionRules {
  type: "single" | "multi";
  minSelect: number;
  maxSelect: number;
}

export function toggleQuestionAnswer(
  question: QuestionnaireSelectionRules,
  current: string[],
  answerId: string,
): string[] {
  if (question.type === "single") {
    return [answerId];
  }

  if (current.includes(answerId)) {
    return current.filter((id) => id !== answerId);
  }

  if (current.length >= question.maxSelect) {
    return current;
  }

  return [...current, answerId];
}

export function canContinue(question: QuestionnaireSelectionRules, selected: string[]) {
  return selected.length >= question.minSelect && selected.length <= question.maxSelect;
}
