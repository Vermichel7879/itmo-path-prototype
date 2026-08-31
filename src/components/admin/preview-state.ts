import type { PublicQuestionnaireDTO, PublicQuestionnaireQuestion } from "@/lib/public-config/questionnaire";
import { canContinue, toggleQuestionAnswer } from "@/lib/questionnaire/answers";

export type PreviewAnswers = Record<string, string[]>;

export function previewRadioGroupName(questionId: string) {
  return `preview-${questionId}`;
}

export function isPreviewEntrepreneurBranchActive(
  questionnaire: PublicQuestionnaireDTO,
  answers: PreviewAnswers,
) {
  const selected = new Set(Object.values(answers).flat());
  return questionnaire.questions.some((question) =>
    question.answers.some((answer) => answer.entrepreneurSignal && selected.has(answer.id)),
  );
}

export function visiblePreviewQuestions(
  questionnaire: PublicQuestionnaireDTO,
  answers: PreviewAnswers,
) {
  const branchActive = isPreviewEntrepreneurBranchActive(questionnaire, answers);
  return questionnaire.questions.filter((question) => !question.entrepreneurshipOnly || branchActive);
}

export function reconcilePreviewAnswers(
  questionnaire: PublicQuestionnaireDTO,
  answers: PreviewAnswers,
): PreviewAnswers {
  const visible = new Set(visiblePreviewQuestions(questionnaire, answers).map((question) => question.id));
  return Object.fromEntries(questionnaire.questions
    .filter((question) => visible.has(question.id))
    .map((question) => {
      const allowed = new Set(question.answers.map((answer) => answer.id));
      return [question.id, (answers[question.id] ?? []).filter((id) => allowed.has(id)).slice(0, question.maxSelect)];
    })
    .filter(([, selected]) => selected.length > 0));
}

export function updatePreviewAnswer(
  questionnaire: PublicQuestionnaireDTO,
  answers: PreviewAnswers,
  question: PublicQuestionnaireQuestion,
  answerId: string,
) {
  return reconcilePreviewAnswers(questionnaire, {
    ...answers,
    [question.id]: toggleQuestionAnswer(question, answers[question.id] ?? [], answerId),
  });
}

export function canCalculatePreview(
  questionnaire: PublicQuestionnaireDTO,
  answers: PreviewAnswers,
) {
  const visible = visiblePreviewQuestions(questionnaire, answers);
  return visible.length > 0 && visible.every((question) =>
    canContinue(question, answers[question.id] ?? []),
  );
}

export function selectedPreviewAnswerIds(questionnaire: PublicQuestionnaireDTO, answers: PreviewAnswers) {
  return visiblePreviewQuestions(questionnaire, answers).flatMap((question) => answers[question.id] ?? []);
}
