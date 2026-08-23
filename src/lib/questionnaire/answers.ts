import type { AnswerId, CareerQuestion } from "@/types/career";

export function toggleQuestionAnswer(
  question: CareerQuestion,
  current: AnswerId[],
  answerId: AnswerId,
): AnswerId[] {
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

export function canContinue(question: CareerQuestion, selected: AnswerId[]) {
  return selected.length >= question.minSelect && selected.length <= question.maxSelect;
}
