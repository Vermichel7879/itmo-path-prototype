import { NextResponse } from "next/server";
import { z } from "zod";

import { trajectoryDataApi } from "@/lib/trajectory/data-api";
import {
  measureServerTiming,
  type ServerTimingMetrics,
  withServerTiming,
} from "@/lib/http/server-timing";

const answerSaveSchema = z
  .object({
    sessionId: z.uuid(),
    questionId: z.string().trim().min(1),
    answerOptionIds: z.array(z.string().trim().min(1)).max(75),
  })
  .strict();

export async function PUT(request: Request) {
  const requestStartedAt = Date.now();
  const timings: ServerTimingMetrics = {};
  const respond = (body: unknown, status = 200) => withServerTiming(
    NextResponse.json(body, { status }),
    requestStartedAt,
    timings,
  );
  try {
    const parsed = answerSaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return respond({ error: "INVALID_ANSWER_DATA" }, 400);
    }
    await measureServerTiming(
      timings,
      ["session_write", "data_api"],
      () => trajectoryDataApi.replaceAnswers(parsed.data),
    );
    return respond({ ok: true });
  } catch {
    return respond({ error: "ANSWER_SAVE_UNAVAILABLE" }, 503);
  }
}
