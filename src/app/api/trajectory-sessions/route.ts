import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminDataApiError } from "@/lib/supabase/admin-rpc";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";

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
  try {
    const parsed = startSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_START_DATA" }, { status: 400 });
    }
    stage = "latest-published-summary";
    stageStartedAt = Date.now();
    const published = await trajectoryDataApi.getLatestPublishedSummary();
    if (!published) {
      return NextResponse.json({ error: "PUBLISHED_CONFIG_UNAVAILABLE" }, { status: 503 });
    }
    stage = "start-session-rpc";
    stageStartedAt = Date.now();
    return NextResponse.json(
      await trajectoryDataApi.start({
        ...parsed.data,
        configVersionId: published.id,
      }),
      { status: 201 },
    );
  } catch (error) {
    console.error("[SESSION_START_FAILED]", {
      action: stage,
      errorCode: error instanceof AdminDataApiError ? error.code : "UNKNOWN",
      errorMessage: error instanceof AdminDataApiError ? error.message : "SESSION_START_FAILED",
      stageDurationMs: Date.now() - stageStartedAt,
      totalDurationMs: Date.now() - requestStartedAt,
    });
    return NextResponse.json({ error: "SESSION_START_UNAVAILABLE" }, { status: 503 });
  }
}
