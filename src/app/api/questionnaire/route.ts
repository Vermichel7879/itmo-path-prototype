import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { readPinnedPublicQuestionnaire } from "@/lib/public-config/questionnaire-read";
import {
  immutableCacheFailureStatus,
  unwrapImmutableCacheError,
} from "@/lib/public-config/immutable-version-cache";
import {
  AdminDataApiError,
  recordDataApiFailureMetric,
} from "@/lib/supabase/admin-rpc";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";
import {
  measureServerTiming,
  type ServerTimingMetrics,
  withServerTiming,
} from "@/lib/http/server-timing";

export const dynamic = "force-dynamic";

const versionSchema = z.uuid();

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  let stage = "request-validation";
  let sessionDurationMs = 0;
  let pinnedConfigVersionLookupMs = 0;
  let publishedConfigAndDtoReadMs = 0;
  let validationTransformMs = 0;
  const timings: ServerTimingMetrics = {};
  const respond = (body: unknown, status = 200) => withServerTiming(
    NextResponse.json(body, { status }),
    requestStartedAt,
    timings,
  );
  try {
    const requestedVersion = request.nextUrl.searchParams.get("configVersionId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (sessionId && !versionSchema.safeParse(sessionId).success) {
      return respond({ error: "INVALID_SESSION" }, 400);
    }
    if (requestedVersion && !versionSchema.safeParse(requestedVersion).success) {
      return respond({ error: "INVALID_CONFIG_VERSION" }, 400);
    }
    const sessionStartedAt = Date.now();
    stage = "session-lookup";
    const session = sessionId ? await measureServerTiming(
      timings,
      ["session_read", "data_api"],
      () => trajectoryDataApi.getContext(sessionId),
    ) : null;
    sessionDurationMs = Date.now() - sessionStartedAt;
    if (sessionId && (!session || session.status !== "IN_PROGRESS")) {
      return respond({ error: "SESSION_NOT_IN_PROGRESS" }, 409);
    }
    if (session && requestedVersion && requestedVersion !== session.configVersionId) {
      return respond({ error: "CONFIG_VERSION_MISMATCH" }, 409);
    }
    stage = "pinned-config-version-lookup";
    const pinnedLookupStartedAt = Date.now();
    const effectiveVersion = session?.configVersionId ?? requestedVersion;
    pinnedConfigVersionLookupMs = Date.now() - pinnedLookupStartedAt;
    if (!effectiveVersion) {
      return respond({ error: "PUBLISHED_CONFIG_UNAVAILABLE" }, 503);
    }
    stage = "published-config-questionnaire-read";
    const configReadStartedAt = Date.now();
    const readResult = await readPinnedPublicQuestionnaire(
      effectiveVersion,
      session?.educationLevel ?? "MASTER",
    ).catch((error) => {
      const duration = Date.now() - configReadStartedAt;
      const cacheStatus = immutableCacheFailureStatus(error) ?? "MISS";
      timings.config_read = duration;
      if (cacheStatus === "MISS") {
        timings.data_api = (timings.data_api ?? 0) + duration;
        timings.config_cache_load_failure = 0;
      }
      timings[`config_cache_${cacheStatus.toLowerCase()}`] = 0;
      throw unwrapImmutableCacheError(error);
    });
    const questionnaire = readResult.questionnaire;
    publishedConfigAndDtoReadMs = readResult.timing.dataApiReadMs;
    validationTransformMs = readResult.timing.validationTransformMs;
    timings.config_read = readResult.timing.totalMs;
    timings.data_api = (timings.data_api ?? 0) + publishedConfigAndDtoReadMs;
    timings.transform = validationTransformMs;
    timings[`config_cache_${readResult.timing.cacheStatus.toLowerCase()}`] = 0;
    if (readResult.timing.cacheStatus === "MISS") timings.config_cache_load_success = 0;
    if (!questionnaire) {
      return respond({ error: "PUBLISHED_CONFIG_UNAVAILABLE" }, 503);
    }
    const totalDurationMs = Date.now() - requestStartedAt;
    if (totalDurationMs > 2_000) {
      console.warn("[QUESTIONNAIRE_READ_SLOW]", {
        sessionDurationMs,
        pinnedConfigVersionLookupMs,
        publishedConfigAndDtoReadMs,
        validationTransformMs,
        totalDurationMs,
        databaseRequests: 1,
      });
    }
    return respond(questionnaire);
  } catch (error) {
    recordDataApiFailureMetric(timings, error);
    console.error("[QUESTIONNAIRE_READ_FAILED]", {
      stage,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCategory: error instanceof AdminDataApiError ? error.category : "UNKNOWN",
      errorCode: error instanceof AdminDataApiError ? error.code : "UNKNOWN",
      errorMessage: error instanceof AdminDataApiError ? error.message : "QUESTIONNAIRE_READ_FAILED",
      sessionDurationMs,
      pinnedConfigVersionLookupMs,
      publishedConfigAndDtoReadMs,
      validationTransformMs,
      totalDurationMs: Date.now() - requestStartedAt,
    });
    return respond({ error: "PUBLISHED_CONFIG_UNAVAILABLE" }, 503);
  }
}
