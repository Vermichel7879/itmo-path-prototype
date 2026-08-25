import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { getCurrentDraftConfig } from "@/lib/admin/draft-service";
import { requireCapability } from "@/lib/auth/permissions";
import { calculateCareerTrajectoryDebug } from "@/lib/rule-engine/engine";
import { validateQuestionnaireSelection } from "@/lib/rule-engine/validate-selection";

const schema = z.object({ selectedAnswerIds: z.array(z.string()).max(100) });

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    requireCapability(session.role, "PREVIEW");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_PREVIEW_INPUT" }, { status: 400 });
    const draft = await getCurrentDraftConfig();
    const selection = validateQuestionnaireSelection(draft.snapshot, parsed.data.selectedAnswerIds);
    return NextResponse.json(calculateCareerTrajectoryDebug(draft.id, draft.snapshot, selection.effectiveAnswerIds));
  } catch (error) {
    return adminApiError(error);
  }
}
