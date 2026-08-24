import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { getCurrentDraftConfig } from "@/lib/admin/draft-service";
import { getPublishPreparation } from "@/lib/admin/publish-service";
import { getDatabase } from "@/lib/db/client";
import { configVersions } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireAdminApiSession();
    const draft = await getCurrentDraftConfig();
    const preparation = await getPublishPreparation();
    const [published] = await getDatabase()
      .select({ id: configVersions.id, publishedAt: configVersions.publishedAt, versionNumber: configVersions.versionNumber })
      .from(configVersions)
      .where(eq(configVersions.status, "PUBLISHED"))
      .orderBy(desc(configVersions.publishedAt), desc(configVersions.versionNumber))
      .limit(1);
    const s = draft.snapshot;
    return NextResponse.json({
      draft: { id: draft.id, updatedAt: draft.updatedAt, validation: draft.validation },
      published,
      unpublishedChanges: Object.values(preparation.diff).some(
        (entry) => entry.added || entry.changed || entry.removed,
      ),
      counts: {
        questions: s.questions.length,
        answers: s.answers.length,
        mappings: s.mappings.length,
        modules: s.modules.length,
        recommendations: s.recommendations.length,
        opportunities: s.opportunities.length,
        rules: s.engineRules.length,
        modifiers: s.modifiers.length,
      },
      health: { database: "OK", migration: 4 },
    });
  } catch (error) {
    return adminApiError(error);
  }
}
