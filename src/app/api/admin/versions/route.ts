import { NextResponse } from "next/server";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { adminDataApi } from "@/lib/admin/data-api";

export async function GET() {
  try {
    await requireAdminApiSession();
    const versions = await adminDataApi.listVersions();
    return NextResponse.json({ versions });
  } catch (error) {
    return adminApiError(error);
  }
}
