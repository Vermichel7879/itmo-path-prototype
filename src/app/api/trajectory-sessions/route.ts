import { NextResponse } from "next/server";
import { z } from "zod";

import { getLatestPublishedCareerConfig } from "@/lib/db/repositories/published-career-config";
import { trajectoryDataApi } from "@/lib/trajectory/data-api";

const startSchema = z
  .object({
    isu: z.string().trim().regex(/^\d+$/),
    educationLevel: z.enum(["BACHELOR", "MASTER"]),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const parsed = startSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_START_DATA" }, { status: 400 });
    }
    const published = await getLatestPublishedCareerConfig();
    if (!published) {
      return NextResponse.json({ error: "PUBLISHED_CONFIG_UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json(
      await trajectoryDataApi.start({
        ...parsed.data,
        configVersionId: published.id,
      }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "SESSION_START_UNAVAILABLE" }, { status: 503 });
  }
}
