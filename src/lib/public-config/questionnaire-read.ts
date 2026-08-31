import "server-only";

import type { EducationLevel } from "@/lib/career/audience";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";
import {
  questionnaireInstruction,
  type PublicQuestionnaireDTO,
} from "./questionnaire";

export interface QuestionnaireReadTiming {
  dataApiReadMs: number;
  validationTransformMs: number;
}

interface PinnedQuestionnaireReader {
  getPinnedQuestionnaireData(
    configVersionId: string,
    educationLevel: EducationLevel,
  ): Promise<{
    configVersionId: string;
    educationLevel: EducationLevel;
    branchQuestionIds: string[];
    signalTag: string;
    questions: Array<{
      id: string;
      block: string;
      title: string;
      selectionType: "SINGLE" | "MULTI";
      minSelect: number;
      maxSelect: number;
      required: boolean;
      answers: Array<{ id: string; text: string; tags: string[] }>;
    }>;
  } | null>;
}

export async function readPinnedPublicQuestionnaire(
  configVersionId: string,
  educationLevel: EducationLevel,
  reader: PinnedQuestionnaireReader = trajectoryDataApi,
): Promise<{ questionnaire: PublicQuestionnaireDTO | null; timing: QuestionnaireReadTiming }> {
  const readStartedAt = Date.now();
  const compact = await reader.getPinnedQuestionnaireData(configVersionId, educationLevel);
  const dataApiReadMs = Date.now() - readStartedAt;
  if (!compact) {
    return { questionnaire: null, timing: { dataApiReadMs, validationTransformMs: 0 } };
  }
  const transformStartedAt = Date.now();
  const branchQuestionIds = new Set(compact.branchQuestionIds);
  const questionnaire: PublicQuestionnaireDTO = {
    configVersionId: compact.configVersionId,
    educationLevel: compact.educationLevel,
    questions: compact.questions.map((question) => ({
      id: question.id,
      block: question.block,
      title: question.title,
      instruction: questionnaireInstruction(question),
      type: question.selectionType === "SINGLE" ? "single" : "multi",
      minSelect: question.minSelect,
      maxSelect: question.maxSelect,
      required: question.required,
      entrepreneurshipOnly: branchQuestionIds.has(question.id),
      answers: question.answers.map((answer) => ({
        id: answer.id,
        text: answer.text,
        entrepreneurSignal: answer.tags.includes(compact.signalTag),
      })),
    })),
  };
  return {
    questionnaire,
    timing: {
      dataApiReadMs,
      validationTransformMs: Date.now() - transformStartedAt,
    },
  };
}
