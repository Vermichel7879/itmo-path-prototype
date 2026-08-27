import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getLatestPublishedCareerConfig,
  getPublishedCareerConfigById,
} from "@/lib/db/repositories/published-career-config";
import { buildPublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";

export const dynamic = "force-dynamic";

const versionSchema = z.uuid();

export async function GET(request: NextRequest) {
  try {
    const requestedVersion = request.nextUrl.searchParams.get("configVersionId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (sessionId && !versionSchema.safeParse(sessionId).success) {
      return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 });
    }
    if (requestedVersion && !versionSchema.safeParse(requestedVersion).success) {
      return NextResponse.json({ error: "INVALID_CONFIG_VERSION" }, { status: 400 });
    }
    const session = sessionId ? await trajectoryDataApi.getContext(sessionId) : null;
    if (sessionId && (!session || session.status !== "IN_PROGRESS")) {
      return NextResponse.json({ error: "SESSION_NOT_IN_PROGRESS" }, { status: 409 });
    }
    if (session && requestedVersion && requestedVersion !== session.configVersionId) {
      return NextResponse.json({ error: "CONFIG_VERSION_MISMATCH" }, { status: 409 });
    }
    const effectiveVersion = session?.configVersionId ?? requestedVersion;
    const published = effectiveVersion
      ? await getPublishedCareerConfigById(effectiveVersion)
      : await getLatestPublishedCareerConfig();
    if (!published) {
      return NextResponse.json(
        { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      buildPublicQuestionnaireDTO(
        published.id,
        published.snapshot,
        session?.educationLevel ?? "MASTER",
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
