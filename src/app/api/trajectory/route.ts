import { NextResponse } from "next/server";

import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";
import {
  QuestionnaireValidationError,
  trajectoryRequestSchema,
  validateQuestionnaireSelection,
} from "@/lib/rule-engine/validate-selection";
import { filterCareerConfigByAudience } from "@/lib/career/audience";
import { readPinnedEngineConfig } from "@/lib/public-config/engine-config-read";
import {
  immutableCacheFailureStatus,
  unwrapImmutableCacheError,
} from "@/lib/public-config/immutable-version-cache";
import {
  AdminDataApiError,
  recordDataApiFailureMetric,
} from "@/lib/supabase/admin-rpc";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";
import { buildTrajectoryCompletionPayload } from "@/lib/trajectory/persistence";
import {
  measureServerTiming,
  type ServerTimingMetrics,
  withServerTiming,
} from "@/lib/http/server-timing";

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const timings: Record<string, number> = {};
  const serverTimings: ServerTimingMetrics = {};
  const respond = (body: unknown, status = 200) => withServerTiming(
    NextResponse.json(body, { status }),
    requestStartedAt,
    serverTimings,
  );
  let stage = "request";
  let stageStartedAt = requestStartedAt;
  try {
    const parsed = trajectoryRequestSchema.safeParse(await request.json());
    timings.request = Date.now() - stageStartedAt;
    if (!parsed.success) {
      return respond({ error: "INVALID_REQUEST" }, 400);
    }
    stage = "session-lookup";
    stageStartedAt = Date.now();
    const session = await measureServerTiming(
      serverTimings,
      ["session_read", "data_api"],
      () => trajectoryDataApi.getContext(parsed.data.sessionId),
    );
    timings.sessionLookup = Date.now() - stageStartedAt;
    if (!session || session.status !== "IN_PROGRESS") {
      return respond({ error: "SESSION_NOT_IN_PROGRESS" }, 409);
    }
    if (session.configVersionId !== parsed.data.configVersionId) {
      return respond({ error: "CONFIG_VERSION_MISMATCH" }, 409);
    }
    stage = "pinned-config-read";
    stageStartedAt = Date.now();
    const configReadStartedAt = Date.now();
    const engineRead = await readPinnedEngineConfig(
      session.configVersionId,
      trajectoryDataApi,
    ).catch((error) => {
      const duration = Date.now() - configReadStartedAt;
      const cacheStatus = immutableCacheFailureStatus(error) ?? "MISS";
      serverTimings.config_read = duration;
      if (cacheStatus === "MISS") {
        serverTimings.data_api = (serverTimings.data_api ?? 0) + duration;
        serverTimings.config_cache_load_failure = 0;
      }
      serverTimings[`config_cache_${cacheStatus.toLowerCase()}`] = 0;
      throw unwrapImmutableCacheError(error);
    });
    timings.pinnedConfigRead = Date.now() - stageStartedAt;
    serverTimings.config_read = engineRead.timing.totalMs;
    serverTimings.data_api = (serverTimings.data_api ?? 0) + engineRead.timing.dataApiReadMs;
    serverTimings.validation = engineRead.timing.validationMs;
    serverTimings[`config_cache_${engineRead.timing.cacheStatus.toLowerCase()}`] = 0;
    if (engineRead.timing.cacheStatus === "MISS") serverTimings.config_cache_load_success = 0;
    if (!engineRead.config) {
      return respond({ error: "CONFIG_VERSION_NOT_PUBLISHED" }, 409);
    }
    const published = engineRead.config;
    timings.engineConfigValidation = engineRead.timing.validationMs;
    if (published.configVersionId !== session.configVersionId) {
      return respond({ error: "CONFIG_VERSION_MISMATCH" }, 409);
    }
    stage = "answers-validation";
    stageStartedAt = Date.now();
    const selection = validateQuestionnaireSelection(
      published.config,
      parsed.data.selectedAnswerIds,
      session.educationLevel,
    );
    timings.answersValidation = Date.now() - stageStartedAt;
    serverTimings.validation += timings.answersValidation;
    stage = "rule-engine";
    stageStartedAt = Date.now();
    const calculation = calculateCareerTrajectoryDebug(
        published.configVersionId,
        published.config,
        selection.effectiveAnswerIds,
        {},
        session.educationLevel,
      );
    timings.ruleEngine = Date.now() - stageStartedAt;
    serverTimings.rule_engine = timings.ruleEngine;
    const audienceConfig = filterCareerConfigByAudience(
      published.config,
      session.educationLevel,
    );
    stage = "result-persistence";
    stageStartedAt = Date.now();
    await measureServerTiming(
      serverTimings,
      ["completion_write", "session_write", "data_api"],
      () => trajectoryDataApi.complete({
        sessionId: session.id,
        selectedAnswerIds: selection.effectiveAnswerIds,
        payload: buildTrajectoryCompletionPayload(
          audienceConfig,
          selection.effectiveAnswerIds,
          calculation,
        ),
      }),
    );
    timings.resultPersistence = Date.now() - stageStartedAt;
    stage = "response";
    stageStartedAt = Date.now();
    const response = respond(calculation.result);
    timings.response = Date.now() - stageStartedAt;
    const totalDurationMs = Date.now() - requestStartedAt;
    if (totalDurationMs > 2_000) {
      console.warn("[TRAJECTORY_SLOW]", { ...timings, totalDurationMs });
    }
    return response;
  } catch (error) {
    if (error instanceof QuestionnaireValidationError) {
      return respond({ error: error.code, questionId: error.questionId }, 422);
    }
    if (!(stage in timings)) timings[stage] = Date.now() - stageStartedAt;
    recordDataApiFailureMetric(serverTimings, error);
    console.error("[TRAJECTORY_FAILED]", {
      stage,
      errorCategory: error instanceof AdminDataApiError ? error.category : "APPLICATION",
      errorCode: error instanceof AdminDataApiError ? error.code : "TRAJECTORY_CALCULATION_FAILED",
      errorMessage: error instanceof AdminDataApiError ? error.message : "TRAJECTORY_CALCULATION_FAILED",
      ...timings,
      totalDurationMs: Date.now() - requestStartedAt,
    });
    return respond({ error: "TRAJECTORY_UNAVAILABLE" }, 503);
  }
}
