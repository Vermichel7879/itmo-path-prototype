import { NextResponse } from "next/server";

import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";
import {
  QuestionnaireValidationError,
  trajectoryRequestSchema,
  validateQuestionnaireSelection,
} from "@/lib/rule-engine/validate-selection";
import { filterCareerConfigByAudience } from "@/lib/career/audience";
import { validatePinnedEngineConfig } from "@/lib/public-config/engine-config";
import { AdminDataApiError } from "@/lib/supabase/admin-rpc";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";
import { buildTrajectoryCompletionPayload } from "@/lib/trajectory/persistence";

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const timings: Record<string, number> = {};
  let stage = "request";
  let stageStartedAt = requestStartedAt;
  try {
    const parsed = trajectoryRequestSchema.safeParse(await request.json());
    timings.request = Date.now() - stageStartedAt;
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    stage = "session-lookup";
    stageStartedAt = Date.now();
    const session = await trajectoryDataApi.getContext(parsed.data.sessionId);
    timings.sessionLookup = Date.now() - stageStartedAt;
    if (!session || session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "SESSION_NOT_IN_PROGRESS" }, { status: 409 });
    }
    if (session.configVersionId !== parsed.data.configVersionId) {
      return NextResponse.json({ error: "CONFIG_VERSION_MISMATCH" }, { status: 409 });
    }
    stage = "pinned-config-read";
    stageStartedAt = Date.now();
    const pinnedConfig = await trajectoryDataApi.getPinnedEngineConfig(session.configVersionId);
    timings.pinnedConfigRead = Date.now() - stageStartedAt;
    if (!pinnedConfig) {
      return NextResponse.json({ error: "CONFIG_VERSION_NOT_PUBLISHED" }, { status: 409 });
    }
    stage = "engine-config-validation";
    stageStartedAt = Date.now();
    const published = validatePinnedEngineConfig(pinnedConfig);
    timings.engineConfigValidation = Date.now() - stageStartedAt;
    if (published.configVersionId !== session.configVersionId) {
      return NextResponse.json({ error: "CONFIG_VERSION_MISMATCH" }, { status: 409 });
    }
    stage = "answers-validation";
    stageStartedAt = Date.now();
    const selection = validateQuestionnaireSelection(
      published.config,
      parsed.data.selectedAnswerIds,
      session.educationLevel,
    );
    timings.answersValidation = Date.now() - stageStartedAt;
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
    const audienceConfig = filterCareerConfigByAudience(
      published.config,
      session.educationLevel,
    );
    stage = "result-persistence";
    stageStartedAt = Date.now();
    await trajectoryDataApi.complete({
      sessionId: session.id,
      selectedAnswerIds: selection.effectiveAnswerIds,
      payload: buildTrajectoryCompletionPayload(
        audienceConfig,
        selection.effectiveAnswerIds,
        calculation,
      ),
    });
    timings.resultPersistence = Date.now() - stageStartedAt;
    stage = "response";
    stageStartedAt = Date.now();
    const response = NextResponse.json(calculation.result);
    timings.response = Date.now() - stageStartedAt;
    const totalDurationMs = Date.now() - requestStartedAt;
    if (totalDurationMs > 2_000) {
      console.warn("[TRAJECTORY_SLOW]", { ...timings, totalDurationMs });
    }
    return response;
  } catch (error) {
    if (error instanceof QuestionnaireValidationError) {
      return NextResponse.json(
        { error: error.code, questionId: error.questionId },
        { status: 422 },
      );
    }
    if (!(stage in timings)) timings[stage] = Date.now() - stageStartedAt;
    console.error("[TRAJECTORY_FAILED]", {
      stage,
      errorCategory: error instanceof AdminDataApiError ? error.category : "APPLICATION",
      errorCode: error instanceof AdminDataApiError ? error.code : "TRAJECTORY_CALCULATION_FAILED",
      errorMessage: error instanceof AdminDataApiError ? error.message : "TRAJECTORY_CALCULATION_FAILED",
      ...timings,
      totalDurationMs: Date.now() - requestStartedAt,
    });
    return NextResponse.json({ error: "TRAJECTORY_UNAVAILABLE" }, { status: 503 });
  }
}
