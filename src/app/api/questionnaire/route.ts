import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getLatestPublishedCareerConfig,
  getPublishedCareerConfigById,
} from "@/lib/db/repositories/published-career-config";
import { buildPublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";

export const dynamic = "force-dynamic";

const versionSchema = z.uuid();

export async function GET(request: NextRequest) {
  try {
    const requestedVersion = request.nextUrl.searchParams.get("configVersionId");
    if (requestedVersion && !versionSchema.safeParse(requestedVersion).success) {
      return NextResponse.json({ error: "INVALID_CONFIG_VERSION" }, { status: 400 });
    }
    const published = requestedVersion
      ? await getPublishedCareerConfigById(requestedVersion)
      : await getLatestPublishedCareerConfig();
    if (!published) {
      return NextResponse.json(
        { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      buildPublicQuestionnaireDTO(published.id, published.snapshot),
    );
  } catch {
    return NextResponse.json(
      { error: "PUBLISHED_CONFIG_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
