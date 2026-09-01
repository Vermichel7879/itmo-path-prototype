import { describe, expect, it, vi } from "vitest";

import type { PublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import {
  buildCurrentSessionAnswerSet,
  createAnswerBatchController,
  runAfterFinalAnswerFlush,
  sessionAnswerSetSaveSchema,
  type SessionAnswerSetItem,
} from "./answer-batch";

function progressiveSet(count: number): SessionAnswerSetItem[] {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `Q${index + 1}`,
    answerOptionIds: [`Q${index + 1}_A1`],
  }));
}

describe("public answer batching", () => {
  it("combines three completed questions into one full-set flush", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const controller = createAnswerBatchController(save, 3);

    await expect(controller.recordCompleted(progressiveSet(1))).resolves.toBe(false);
    await expect(controller.recordCompleted(progressiveSet(2))).resolves.toBe(false);
    await expect(controller.recordCompleted(progressiveSet(3))).resolves.toBe(true);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(progressiveSet(3));
  });

  it("performs the final flush before trajectory submission", async () => {
    const order: string[] = [];
    const controller = createAnswerBatchController(async () => {
      order.push("save");
    });
    await controller.recordCompleted(progressiveSet(1));

    await runAfterFinalAnswerFlush(controller, async () => {
      order.push("trajectory");
    });

    expect(order).toEqual(["save", "trajectory"]);
  });

  it("serializes writes and preserves changes made during a pending flush", async () => {
    let releaseFirst!: () => void;
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let activeWrites = 0;
    let maximumActiveWrites = 0;
    const payloads: SessionAnswerSetItem[][] = [];
    const save = vi.fn(async (answerSet: SessionAnswerSetItem[]) => {
      activeWrites += 1;
      maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
      payloads.push(answerSet);
      if (payloads.length === 1) await firstPending;
      activeWrites -= 1;
    });
    const controller = createAnswerBatchController(save, 3);

    await controller.recordCompleted(progressiveSet(1));
    await controller.recordCompleted(progressiveSet(2));
    const third = controller.recordCompleted(progressiveSet(3));
    const fourth = controller.recordCompleted(progressiveSet(4));
    const fifth = controller.recordCompleted(progressiveSet(5));
    const sixth = controller.recordCompleted(progressiveSet(6));
    releaseFirst();
    await Promise.all([third, fourth, fifth, sixth]);

    expect(maximumActiveWrites).toBe(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(payloads[1]).toEqual(progressiveSet(6));
  });

  it("removes hidden entrepreneurship answers from the next full set", () => {
    const questionnaire = {
      configVersionId: "00000000-0000-4000-8000-000000000123",
      educationLevel: "MASTER",
      questions: [
        {
          id: "Q1",
          block: "base",
          title: "base",
          instruction: "one",
          type: "single",
          minSelect: 1,
          maxSelect: 1,
          required: true,
          entrepreneurshipOnly: false,
          answers: [{ id: "Q1_A1", text: "base", entrepreneurSignal: false }],
        },
        {
          id: "Q9",
          block: "branch",
          title: "branch",
          instruction: "one",
          type: "single",
          minSelect: 1,
          maxSelect: 1,
          required: true,
          entrepreneurshipOnly: true,
          answers: [{ id: "Q9_A1", text: "branch", entrepreneurSignal: false }],
        },
      ],
    } satisfies PublicQuestionnaireDTO;
    const answers = { Q1: ["Q1_A1"], Q9: ["Q9_A1"] };

    expect(buildCurrentSessionAnswerSet(answers, questionnaire, true)).toHaveLength(2);
    expect(buildCurrentSessionAnswerSet(answers, questionnaire, false)).toEqual([
      { questionId: "Q1", answerOptionIds: ["Q1_A1"] },
    ]);
  });

  it("does not submit trajectory when the final save fails", async () => {
    const controller = createAnswerBatchController(async () => {
      throw new Error("save failed");
    });
    const submit = vi.fn();
    await controller.recordCompleted(progressiveSet(1));

    await expect(runAfterFinalAnswerFlush(controller, submit)).rejects.toThrow("save failed");
    expect(submit).not.toHaveBeenCalled();
  });

  it("accepts one full current answer set in the batch API payload", () => {
    expect(sessionAnswerSetSaveSchema.parse({
      sessionId: "00000000-0000-4000-8000-000000000103",
      answers: progressiveSet(3),
    })).toMatchObject({ answers: progressiveSet(3) });
  });
});
