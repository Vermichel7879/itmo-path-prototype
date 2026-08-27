import type { CareerImport } from "../db/import/import-model";
import { filterCareerConfigByAudience, type EducationLevel } from "../career/audience";

export interface PublicQuestionnaireAnswer {
  id: string;
  text: string;
  entrepreneurSignal: boolean;
}

export interface PublicQuestionnaireQuestion {
  id: string;
  block: string;
  title: string;
  instruction: string;
  type: "single" | "multi";
  minSelect: number;
  maxSelect: number;
  required: boolean;
  entrepreneurshipOnly: boolean;
  answers: PublicQuestionnaireAnswer[];
}

export interface PublicQuestionnaireDTO {
  configVersionId: string;
  educationLevel: EducationLevel;
  questions: PublicQuestionnaireQuestion[];
}

function instructionFor(question: CareerImport["questions"][number]) {
  if (question.selectionType === "SINGLE") return "Выберите один вариант";
  if (!question.required && question.minSelect === 0) {
    return `Можно пропустить или выбрать до ${question.maxSelect} вариантов`;
  }
  if (question.minSelect === question.maxSelect) {
    return `Выберите ${question.maxSelect} вариантов`;
  }
  return `Выберите от ${question.minSelect} до ${question.maxSelect} вариантов`;
}

export function buildPublicQuestionnaireDTO(
  configVersionId: string,
  config: CareerImport,
  educationLevel: EducationLevel = "MASTER",
): PublicQuestionnaireDTO {
  config = filterCareerConfigByAudience(config, educationLevel);
  const branchRule = config.engineRules.find(
    (rule) => rule.ruleKind === "CONDITIONAL_BRANCH",
  );
  if (!branchRule || branchRule.params.condition.kind !== "ANSWER_TAG_SELECTED") {
    throw new Error("PUBLIC_QUESTIONNAIRE_CONFIG_ERROR invalid_branch_rule");
  }
  const branchQuestionIds = new Set(branchRule.params.questionIds);
  const signalTag = branchRule.params.condition.tag;

  return {
    configVersionId,
    educationLevel,
    questions: config.questions
      .filter((question) => question.active)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((question) => ({
        id: question.stableId,
        block: question.block,
        title: question.text,
        instruction: instructionFor(question),
        type: question.selectionType === "SINGLE" ? "single" : "multi",
        minSelect: question.minSelect,
        maxSelect: question.maxSelect,
        required: question.required,
        entrepreneurshipOnly: branchQuestionIds.has(question.stableId),
        answers: config.answers
          .filter(
            (answer) =>
              answer.active && answer.questionStableId === question.stableId,
          )
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((answer) => ({
            id: answer.stableId,
            text: answer.text,
            entrepreneurSignal: answer.tags.includes(signalTag),
          })),
      })),
  };
}
