import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { getCurrentDraftConfig } from "@/lib/admin/draft-service";
import { buildAdminPreviewExplanation } from "@/lib/admin/preview-debug";
import { requireCapability } from "@/lib/auth/permissions";
import { filterCareerConfigByAudience } from "@/lib/career/audience";
import { buildPublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";
import { validateQuestionnaireSelection } from "@/lib/rule-engine/validate-selection";

const schema = z.object({ selectedAnswerIds: z.array(z.string()).max(100), educationLevel: z.enum(["BACHELOR", "MASTER"]).default("MASTER") });
const educationSchema = z.enum(["BACHELOR", "MASTER"]);

export async function GET(request: Request) {
  try {
    const session = await requireAdminApiSession();
    requireCapability(session.role, "PREVIEW");
    const educationLevel = educationSchema.safeParse(new URL(request.url).searchParams.get("educationLevel") ?? "MASTER");
    if (!educationLevel.success) return NextResponse.json({ error: "INVALID_EDUCATION_LEVEL" }, { status: 400 });
    const draft = await getCurrentDraftConfig();
    const questionnaire = buildPublicQuestionnaireDTO(draft.id, draft.snapshot, educationLevel.data);
    const available = questionnaire.questions.length > 0 && questionnaire.questions.some((question) => question.answers.length > 0);
    return NextResponse.json({
      available,
      questionnaire: available ? questionnaire : null,
      message: available ? null : educationLevel.data === "BACHELOR"
        ? "Анкета для бакалавриата пока не настроена в текущем DRAFT."
        : "Анкета для магистратуры пока не настроена в текущем DRAFT.",
    });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    requireCapability(session.role, "PREVIEW");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_PREVIEW_INPUT" }, { status: 400 });
    const draft = await getCurrentDraftConfig();
    const audienceConfig = filterCareerConfigByAudience(draft.snapshot, parsed.data.educationLevel);
    const selection = validateQuestionnaireSelection(audienceConfig, parsed.data.selectedAnswerIds, parsed.data.educationLevel);
    const calculation = calculateCareerTrajectoryDebug(draft.id, audienceConfig, selection.effectiveAnswerIds, {}, parsed.data.educationLevel);
    return NextResponse.json({
      ...calculation,
      explanation: buildAdminPreviewExplanation(audienceConfig, calculation),
    });
  } catch (error) {
    return adminApiError(error);
  }
}
