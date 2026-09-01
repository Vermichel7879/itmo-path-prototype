import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { replaceAnswerSet, replaceAnswers } = vi.hoisted(() => ({
  replaceAnswerSet: vi.fn(),
  replaceAnswers: vi.fn(),
}));

vi.mock("@/lib/trajectory/data-api", () => ({
  trajectoryDataApi: { replaceAnswerSet, replaceAnswers },
}));

import { PUT } from "./route";

describe("trajectory answer save API", () => {
  beforeEach(() => {
    replaceAnswerSet.mockReset().mockResolvedValue({ ok: true });
    replaceAnswers.mockReset().mockResolvedValue({ ok: true });
  });

  it("sends a full answer set through exactly one batch RPC", async () => {
    const payload = {
      sessionId: "00000000-0000-4000-8000-000000000103",
      answers: [
        { questionId: "Q1", answerOptionIds: ["Q1_A1"] },
        { questionId: "Q2", answerOptionIds: ["Q2_A2"] },
      ],
    };
    const response = await PUT(new Request("http://localhost/api/trajectory-sessions/answers", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    expect(replaceAnswerSet).toHaveBeenCalledTimes(1);
    expect(replaceAnswerSet).toHaveBeenCalledWith(payload);
    expect(replaceAnswers).not.toHaveBeenCalled();
  });

  it("keeps the legacy single-question contract available", async () => {
    const payload = {
      sessionId: "00000000-0000-4000-8000-000000000103",
      questionId: "Q1",
      answerOptionIds: ["Q1_A1"],
    };
    const response = await PUT(new Request("http://localhost/api/trajectory-sessions/answers", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    expect(replaceAnswers).toHaveBeenCalledTimes(1);
    expect(replaceAnswerSet).not.toHaveBeenCalled();
  });
});
