import { z } from "zod";

import type { PublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";

export const sessionAnswerSetItemSchema = z
  .object({
    questionId: z.string().trim().min(1),
    answerOptionIds: z.array(z.string().trim().min(1)).max(75),
  })
  .strict();

export const sessionAnswerSetSaveSchema = z
  .object({
    sessionId: z.uuid(),
    answers: z.array(sessionAnswerSetItemSchema).max(20),
  })
  .strict();

export type SessionAnswerSetItem = z.infer<typeof sessionAnswerSetItemSchema>;

export function buildCurrentSessionAnswerSet(
  answers: Record<string, string[]>,
  questionnaire: PublicQuestionnaireDTO,
  entrepreneurshipEnabled: boolean,
): SessionAnswerSetItem[] {
  return questionnaire.questions.flatMap((question) => {
    if (question.entrepreneurshipOnly && !entrepreneurshipEnabled) return [];
    const validIds = new Set(question.answers.map((answer) => answer.id));
    const answerOptionIds = (answers[question.id] ?? []).filter((id) => validIds.has(id));
    return answerOptionIds.length > 0 ? [{ questionId: question.id, answerOptionIds }] : [];
  });
}

export interface AnswerBatchController {
  recordCompleted(answerSet: SessionAnswerSetItem[]): Promise<boolean>;
  flushFinal(): Promise<boolean>;
}

function copyAnswerSet(answerSet: SessionAnswerSetItem[]) {
  return answerSet.map((answer) => ({
    questionId: answer.questionId,
    answerOptionIds: [...answer.answerOptionIds],
  }));
}

export function createAnswerBatchController(
  save: (answerSet: SessionAnswerSetItem[]) => Promise<void>,
  batchSize = 3,
): AnswerBatchController {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("ANSWER_BATCH_SIZE_INVALID");
  }

  let latestAnswerSet: SessionAnswerSetItem[] = [];
  let revision = 0;
  let savedRevision = 0;
  let inFlight: Promise<void> | null = null;

  async function flush(force: boolean): Promise<boolean> {
    if (revision === savedRevision) return false;
    if (!force && revision - savedRevision < batchSize) return false;

    if (inFlight) {
      await inFlight;
      return flush(force);
    }

    const targetRevision = revision;
    const payload = copyAnswerSet(latestAnswerSet);
    const request = save(payload).then(() => {
      savedRevision = Math.max(savedRevision, targetRevision);
    });
    inFlight = request;
    try {
      await request;
    } finally {
      if (inFlight === request) inFlight = null;
    }

    if (revision > savedRevision && (force || revision - savedRevision >= batchSize)) {
      await flush(force);
    }
    return true;
  }

  return {
    recordCompleted(answerSet) {
      latestAnswerSet = copyAnswerSet(answerSet);
      revision += 1;
      return flush(false);
    },
    flushFinal() {
      return flush(true);
    },
  };
}

export async function runAfterFinalAnswerFlush<T>(
  controller: AnswerBatchController,
  submit: () => Promise<T>,
) {
  await controller.flushFinal();
  return submit();
}
