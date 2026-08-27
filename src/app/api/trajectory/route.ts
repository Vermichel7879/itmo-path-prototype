import { NextResponse } from "next/server";

import { getPublishedCareerConfigById } from "@/lib/db/repositories/published-career-config";
import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";
import {
  QuestionnaireValidationError,
  trajectoryRequestSchema,
  validateQuestionnaireSelection,
} from "@/lib/rule-engine/validate-selection";
import { filterCareerConfigByAudience } from "@/lib/career/audience";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";
import { buildTrajectoryCompletionPayload } from "@/lib/trajectory/persistence";

export async function POST(request: Request) {
  try {
    const parsed = trajectoryRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const session = await trajectoryDataApi.getContext(parsed.data.sessionId);
    if (!session || session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "SESSION_NOT_IN_PROGRESS" }, { status: 409 });
    }
    if (session.configVersionId !== parsed.data.configVersionId) {
      return NextResponse.json({ error: "CONFIG_VERSION_MISMATCH" }, { status: 409 });
    }
    const published = await getPublishedCareerConfigById(session.configVersionId);
    if (!published) {
      return NextResponse.json({ error: "CONFIG_VERSION_NOT_PUBLISHED" }, { status: 409 });
    }
    const selection = validateQuestionnaireSelection(
      published.snapshot,
      parsed.data.selectedAnswerIds,
      session.educationLevel,
    );
    const calculation = calculateCareerTrajectoryDebug(
        published.id,
        published.snapshot,
        selection.effectiveAnswerIds,
        {},
        session.educationLevel,
      );
    const audienceConfig = filterCareerConfigByAudience(
      published.snapshot,
      session.educationLevel,
    );
    await trajectoryDataApi.complete({
      sessionId: session.id,
      selectedAnswerIds: selection.effectiveAnswerIds,
      payload: buildTrajectoryCompletionPayload(
        audienceConfig,
        selection.effectiveAnswerIds,
        calculation,
      ),
    });
    return NextResponse.json(calculation.result);
  } catch (error) {
    if (error instanceof QuestionnaireValidationError) {
      return NextResponse.json(
        { error: error.code, questionId: error.questionId },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "TRAJECTORY_UNAVAILABLE" }, { status: 503 });
  }
}
