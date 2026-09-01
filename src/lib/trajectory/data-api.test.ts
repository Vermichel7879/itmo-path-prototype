import { describe, expect, it, vi } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validatePublishableCareerSnapshot } from "@/lib/db/publish/publish-validation";

vi.mock("server-only", () => ({}));

import { createTrajectoryDataApi } from "./data-api";

function clientWith(handler: (name: string, args: Record<string, unknown>) => unknown) {
  return {
    async rpc(name: string, args: Record<string, unknown> = {}) {
      return { data: handler(name, args), error: null };
    },
  };
}

function pinnedEngineResponse(configVersionId: string) {
  const config = validatePublishableCareerSnapshot(structuredClone(seed));
  return {
    configVersionId,
    config: {
      questions: config.questions,
      answers: config.answers,
      mappings: config.mappings,
      modules: config.modules,
      modifiers: config.modifiers,
      recommendations: config.recommendations,
      moduleRecommendations: config.moduleRecommendations,
      opportunities: config.opportunities,
      entrepreneurStages: config.entrepreneurStages,
      entrepreneurChallenges: config.entrepreneurChallenges,
      engineRules: config.engineRules,
    },
  };
}

describe("trajectory session Data API", () => {
  it("reads only compact published metadata before session start", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const api = createTrajectoryDataApi(clientWith((name, args) => {
      calls.push({ name, args });
      return {
        id: "00000000-0000-4000-8000-000000000001",
        versionNumber: 1,
        publishedAt: "2026-08-31T00:00:00+00:00",
      };
    }));

    await api.getLatestPublishedSummary();

    expect(calls).toEqual([{ name: "admin_get_latest_published_summary", args: {} }]);
  });

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

  it("starts a session through exactly one write RPC with the route education level", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const api = createTrajectoryDataApi(clientWith((name, args) => {
      calls.push({ name, args });
      return {
        sessionId: "00000000-0000-4000-8000-000000000103",
        configVersionId: args.p_config_version_id,
        educationLevel: args.p_education_level,
        status: "IN_PROGRESS",
      };
    }));

    await api.start({
      isu: "467695",
      educationLevel: "MASTER",
      configVersionId: "00000000-0000-4000-8000-000000000001",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: "public_start_trajectory_session",
      args: { p_education_level: "MASTER" },
    });
  });

  it("uses the pinned version for the questionnaire RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const api = createTrajectoryDataApi(clientWith((name, args) => {
      calls.push({ name, args });
      return null;
    }));
    await api.getPinnedQuestionnaireData(
      "00000000-0000-4000-8000-000000000123",
      "MASTER",
    );
    expect(calls).toEqual([{
      name: "public_get_pinned_questionnaire",
      args: {
        p_config_version_id: "00000000-0000-4000-8000-000000000123",
        p_education_level: "MASTER",
      },
    }]);
  });

  it("uses exactly the pinned version for the engine RPC without a latest fallback", async () => {
    const pinnedId = "00000000-0000-4000-8000-000000000123";
    const newerId = "00000000-0000-4000-8000-000000000999";
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const api = createTrajectoryDataApi(clientWith((name, args) => {
      calls.push({ name, args });
      return pinnedEngineResponse(pinnedId);
    }));

    const result = await api.getPinnedEngineConfig(pinnedId);

    expect(result?.configVersionId).toBe(pinnedId);
    expect(result?.configVersionId).not.toBe(newerId);
    expect(calls).toEqual([{
      name: "public_get_pinned_engine_config",
      args: { p_config_version_id: pinnedId },
    }]);
  });

  it("returns null when the pinned published version is missing", async () => {
    const api = createTrajectoryDataApi(clientWith(() => null));
    await expect(api.getPinnedEngineConfig(
      "00000000-0000-4000-8000-000000000123",
    )).resolves.toBeNull();
  });

  it("retries one transport failure only for the read-only questionnaire RPC", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "", message: "fetch failed", details: "read ECONNRESET" },
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const api = createTrajectoryDataApi({ rpc });
    await expect(api.getPinnedQuestionnaireData(
      "00000000-0000-4000-8000-000000000123",
      "MASTER",
    )).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2);

    rpc.mockClear();
    rpc.mockResolvedValue({
      data: null,
      error: { code: "", message: "fetch failed", details: "read ECONNRESET" },
    });
    await expect(api.start({
      isu: "1",
      educationLevel: "MASTER",
      configVersionId: "00000000-0000-4000-8000-000000000123",
    })).rejects.toMatchObject({ category: "TRANSPORT" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("retries one transport failure for the pinned engine read but never for completion", async () => {
    const pinnedId = "00000000-0000-4000-8000-000000000123";
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "", message: "fetch failed", details: "read ECONNRESET" },
      })
      .mockResolvedValueOnce({ data: pinnedEngineResponse(pinnedId), error: null });
    const api = createTrajectoryDataApi({ rpc });

    await expect(api.getPinnedEngineConfig(pinnedId)).resolves.toMatchObject({
      configVersionId: pinnedId,
    });
    expect(rpc).toHaveBeenCalledTimes(2);

    rpc.mockClear();
    rpc.mockResolvedValue({
      data: null,
      error: { code: "", message: "fetch failed", details: "read ECONNRESET" },
    });
    await expect(api.complete({
      sessionId: "00000000-0000-4000-8000-000000000103",
      selectedAnswerIds: [],
      payload: {} as never,
    })).rejects.toMatchObject({ category: "TRANSPORT" });
    expect(rpc).toHaveBeenCalledTimes(1);
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

  it("replaces a full answer set through one RPC before unchanged completion", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const api = createTrajectoryDataApi(clientWith((name, args) => {
      calls.push({ name, args });
      return { ok: true };
    }));
    const sessionId = "00000000-0000-4000-8000-000000000103";
    const answers = [
      { questionId: "Q1", answerOptionIds: ["Q1_A1"] },
      { questionId: "Q2", answerOptionIds: ["Q2_A2"] },
    ];

    await api.replaceAnswerSet({ sessionId, answers });
    await api.complete({
      sessionId,
      selectedAnswerIds: ["Q1_A1", "Q2_A2"],
      payload: {} as never,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      name: "public_replace_session_answer_set",
      args: { p_session_id: sessionId, p_answers: answers },
    });
    expect(calls[1]).toMatchObject({
      name: "public_complete_trajectory_session",
      args: { p_selected_answer_ids: ["Q1_A1", "Q2_A2"] },
    });
  });
});
