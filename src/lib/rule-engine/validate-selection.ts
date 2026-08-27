import { z } from "zod";

import type { CareerImport } from "../db/import/import-model";
import { isEntrepreneurBranchActive } from "./engine";
import { filterCareerConfigByAudience, type EducationLevel } from "../career/audience";

export const trajectoryRequestSchema = z
  .object({
    configVersionId: z.uuid(),
    sessionId: z.uuid(),
    selectedAnswerIds: z.array(z.string().trim().min(1)).max(75),
  })
  .strict();

export class QuestionnaireValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly questionId?: string,
  ) {
    super(`QUESTIONNAIRE_VALIDATION_ERROR code=${code}`);
    this.name = "QuestionnaireValidationError";
  }
}

export function validateQuestionnaireSelection(
  config: CareerImport,
  selectedAnswerIds: string[],
  educationLevel: EducationLevel = "MASTER",
) {
  config = filterCareerConfigByAudience(config, educationLevel);
  if (new Set(selectedAnswerIds).size !== selectedAnswerIds.length) {
    throw new QuestionnaireValidationError("DUPLICATE_ANSWER_ID");
  }
  const answerById = new Map(
    config.answers.filter((answer) => answer.active).map((answer) => [answer.stableId, answer]),
  );
  for (const answerId of selectedAnswerIds) {
    if (!answerById.has(answerId)) {
      throw new QuestionnaireValidationError("UNKNOWN_ANSWER_ID");
    }
  }

  const branchRule = config.engineRules.find(
    (rule) => rule.ruleKind === "CONDITIONAL_BRANCH",
  );
  if (!branchRule) throw new Error("RULE_ENGINE_CONFIG_ERROR missing=CONDITIONAL_BRANCH");
  const branchQuestionIds = new Set(branchRule.params.questionIds);
  const activeBranch = isEntrepreneurBranchActive(config, selectedAnswerIds);
  const ignoredAnswerIds = activeBranch
    ? []
    : selectedAnswerIds.filter((answerId) =>
        branchQuestionIds.has(answerById.get(answerId)!.questionStableId),
      );
  const ignored = new Set(ignoredAnswerIds);
  const effectiveAnswerIds = selectedAnswerIds.filter((id) => !ignored.has(id));

  for (const question of config.questions.filter((item) => item.active)) {
    if (branchQuestionIds.has(question.stableId) && !activeBranch) continue;
    const selectedForQuestion = effectiveAnswerIds.filter(
      (answerId) => answerById.get(answerId)!.questionStableId === question.stableId,
    );
    if (question.required && selectedForQuestion.length < question.minSelect) {
      throw new QuestionnaireValidationError("MIN_SELECT", question.stableId);
    }
    if (selectedForQuestion.length > question.maxSelect) {
      throw new QuestionnaireValidationError("MAX_SELECT", question.stableId);
    }
    if (question.selectionType === "SINGLE" && selectedForQuestion.length > 1) {
      throw new QuestionnaireValidationError("SINGLE_SELECT", question.stableId);
    }
  }

  return { effectiveAnswerIds, ignoredAnswerIds, activeBranch };
}
