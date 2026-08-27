import { NextResponse } from "next/server";
import { z } from "zod";

import { trajectoryDataApi } from "@/lib/trajectory/data-api";

const answerSaveSchema = z
  .object({
    sessionId: z.uuid(),
    questionId: z.string().trim().min(1),
    answerOptionIds: z.array(z.string().trim().min(1)).max(75),
  })
  .strict();

export async function PUT(request: Request) {
  try {
    const parsed = answerSaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_ANSWER_DATA" }, { status: 400 });
    }
    await trajectoryDataApi.replaceAnswers(parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ANSWER_SAVE_UNAVAILABLE" }, { status: 503 });
  }
}
