import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTrajectoryDataApi } from "./data-api";

function clientWith(handler: (name: string, args: Record<string, unknown>) => unknown) {
  return {
    async rpc(name: string, args: Record<string, unknown> = {}) {
      return { data: handler(name, args), error: null };
    },
  };
}

describe("trajectory session Data API", () => {
  it("creates a new IN_PROGRESS MASTER session for every start", async () => {
    let sequence = 0;
    const ids = [
      "00000000-0000-4000-8000-000000000101",
      "00000000-0000-4000-8000-000000000102",
    ];
    const api = createTrajectoryDataApi(clientWith((_name, args) => ({
      sessionId: ids[sequence++],
      configVersionId: args.p_config_version_id,
      educationLevel: args.p_education_level,
      status: "IN_PROGRESS",
    })));
    const input = { isu: "467695", educationLevel: "MASTER" as const, configVersionId: "00000000-0000-4000-8000-000000000001" };
    const first = await api.start(input);
    const second = await api.start(input);
    expect(first.status).toBe("IN_PROGRESS");
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.configVersionId).toBe(input.configVersionId);
  });

  it("represents an unavailable BACHELOR session without questionnaire data", async () => {
    const api = createTrajectoryDataApi(clientWith((_name, args) => ({
      sessionId: "00000000-0000-4000-8000-000000000103",
      configVersionId: args.p_config_version_id,
      educationLevel: "BACHELOR",
      status: "UNAVAILABLE",
    })));
    await expect(api.start({ isu: "1", educationLevel: "BACHELOR", configVersionId: "00000000-0000-4000-8000-000000000001" })).resolves.toMatchObject({ status: "UNAVAILABLE" });
  });

  it("replaces current question selections through one RPC call", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const api = createTrajectoryDataApi(clientWith((name, args) => {
      calls.push({ name, args });
      return { ok: true };
    }));
    await api.replaceAnswers({ sessionId: "00000000-0000-4000-8000-000000000103", questionId: "Q2", answerOptionIds: ["Q2_A2"] });
    expect(calls[0]).toMatchObject({ name: "public_replace_session_answers", args: { p_question_id: "Q2", p_answer_option_ids: ["Q2_A2"] } });
  });
});
