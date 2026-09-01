import { NextResponse } from "next/server";
import { z } from "zod";

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

const startSchema = z
  .object({
    isu: z.string().trim().regex(/^\d+$/),
    educationLevel: z.enum(["BACHELOR", "MASTER"]),
  })
  .strict();

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  let stage = "parse-request";
  let stageStartedAt = requestStartedAt;
  const timings: ServerTimingMetrics = {};
  const respond = (body: unknown, status = 200) => withServerTiming(
    NextResponse.json(body, { status }),
    requestStartedAt,
    timings,
  );
  try {
    const parsed = startSchema.safeParse(await request.json());
    if (!parsed.success) {
      return respond({ error: "INVALID_START_DATA" }, 400);
    }
    stage = "latest-published-summary";
    stageStartedAt = Date.now();
    const published = await measureServerTiming(
      timings,
      ["config_read", "data_api"],
      () => trajectoryDataApi.getLatestPublishedSummary(),
    );
    if (!published) {
      return respond({ error: "PUBLISHED_CONFIG_UNAVAILABLE" }, 503);
    }
    stage = "start-session-rpc";
    stageStartedAt = Date.now();
    const session = await measureServerTiming(
      timings,
      ["session_write", "data_api"],
      () => trajectoryDataApi.start({
        ...parsed.data,
        configVersionId: published.id,
      }),
    );
    return respond(session, 201);
  } catch (error) {
    recordDataApiFailureMetric(timings, error);
    console.error("[SESSION_START_FAILED]", {
      action: stage,
      errorCode: error instanceof AdminDataApiError ? error.code : "UNKNOWN",
      errorMessage: error instanceof AdminDataApiError ? error.message : "SESSION_START_FAILED",
      stageDurationMs: Date.now() - stageStartedAt,
      totalDurationMs: Date.now() - requestStartedAt,
    });
    return respond({ error: "SESSION_START_UNAVAILABLE" }, 503);
  }
}
