import { NextResponse } from "next/server";

import { getPublishedCareerConfigById } from "@/lib/db/repositories/published-career-config";
import { calculateCareerTrajectory } from "@/lib/rule-engine/engine";
import {
  QuestionnaireValidationError,
  trajectoryRequestSchema,
  validateQuestionnaireSelection,
} from "@/lib/rule-engine/validate-selection";

export async function POST(request: Request) {
  try {
    const parsed = trajectoryRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const published = await getPublishedCareerConfigById(parsed.data.configVersionId);
    if (!published) {
      return NextResponse.json({ error: "CONFIG_VERSION_NOT_PUBLISHED" }, { status: 409 });
    }
    const selection = validateQuestionnaireSelection(
      published.snapshot,
      parsed.data.selectedAnswerIds,
    );
    return NextResponse.json(
      calculateCareerTrajectory(
        published.id,
        published.snapshot,
        selection.effectiveAnswerIds,
      ),
    );
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
