import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { readPinnedPublicQuestionnaire } from "@/lib/public-config/questionnaire-read";
import { AdminDataApiError } from "@/lib/supabase/admin-rpc";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";

export const dynamic = "force-dynamic";

const versionSchema = z.uuid();

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  let stage = "request-validation";
  let sessionDurationMs = 0;
  let pinnedConfigVersionLookupMs = 0;
  let publishedConfigAndDtoReadMs = 0;
  let validationTransformMs = 0;
  try {
    const requestedVersion = request.nextUrl.searchParams.get("configVersionId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (sessionId && !versionSchema.safeParse(sessionId).success) {
      return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 });
    }
    if (requestedVersion && !versionSchema.safeParse(requestedVersion).success) {
      return NextResponse.json({ error: "INVALID_CONFIG_VERSION" }, { status: 400 });
    }
    const sessionStartedAt = Date.now();
    stage = "session-lookup";
    const session = sessionId ? await trajectoryDataApi.getContext(sessionId) : null;
    sessionDurationMs = Date.now() - sessionStartedAt;
    if (sessionId && (!session || session.status !== "IN_PROGRESS")) {
      return NextResponse.json({ error: "SESSION_NOT_IN_PROGRESS" }, { status: 409 });
    }
    if (session && requestedVersion && requestedVersion !== session.configVersionId) {
      return NextResponse.json({ error: "CONFIG_VERSION_MISMATCH" }, { status: 409 });
    }
    stage = "pinned-config-version-lookup";
    const pinnedLookupStartedAt = Date.now();
    const effectiveVersion = session?.configVersionId ?? requestedVersion;
    pinnedConfigVersionLookupMs = Date.now() - pinnedLookupStartedAt;
    if (!effectiveVersion) {
      return NextResponse.json(
        { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
        { status: 503 },
      );
    }
    stage = "published-config-questionnaire-read";
    const readResult = await readPinnedPublicQuestionnaire(
      effectiveVersion,
      session?.educationLevel ?? "MASTER",
    );
    const questionnaire = readResult.questionnaire;
    publishedConfigAndDtoReadMs = readResult.timing.dataApiReadMs;
    validationTransformMs = readResult.timing.validationTransformMs;
    if (!questionnaire) {
      return NextResponse.json(
        { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
        { status: 503 },
      );
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
    return NextResponse.json(questionnaire);
  } catch (error) {
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
    return NextResponse.json(
      { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
