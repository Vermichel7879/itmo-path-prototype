import "server-only";

import { NextResponse } from "next/server";

import {
  authorizePreviewWriteProbe,
  DB_WRITE_PROBE_SECRET_HEADER,
  runVercelWriteProbe,
  type SafeWriteProbeResult,
} from "@/lib/db/preview-write-probe";

export const maxDuration = 30;

function json(result: SafeWriteProbeResult, status: number) {
  return NextResponse.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const access = authorizePreviewWriteProbe(
    request.headers.get(DB_WRITE_PROBE_SECRET_HEADER),
  );
  if (!access.allowed) return json(access.result, access.status);

  const result = await runVercelWriteProbe();
  return json(result, result.ok ? 200 : 503);
}
