import { NextResponse } from "next/server";

import { AdminAuthorizationError } from "@/lib/auth/permissions";
import { getCurrentAdminSession } from "@/lib/auth/request";
import { AdminDataApiError } from "@/lib/supabase/admin-rpc";

import { DraftConflictError } from "./draft-service";

const safeOperationErrors = new Set([
  "ANSWER_ID_QUESTION_MISMATCH",
  "ADMIN_USER_NOT_FOUND",
  "ADMIN_USERNAME_EXISTS",
  "CURRENT_PASSWORD_INVALID",
  "DRAFT_CONFIG_MISSING",
  "DRAFT_MUTATION_INVALID_CONFIG",
  "MAPPING_ALREADY_EXISTS",
  "MAPPING_AUDIENCE_INCOMPATIBLE",
  "MAPPING_NOT_FOUND",
  "MODULE_ALREADY_EXISTS",
  "RULE_ALREADY_EXISTS",
  "RULE_SORT_ORDER_EXISTS",
  "ANSWER_TAG_NOT_FOUND",
  "MODULE_RECOMMENDATION_ALREADY_EXISTS",
  "MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE",
  "MODULE_RECOMMENDATION_NOT_FOUND",
  "MODULE_NOT_FOUND",
  "RECOMMENDATION_NOT_FOUND",
  "ANSWER_NOT_FOUND",
  "LAST_ACTIVE_ADMIN_PROTECTED",
  "OPPORTUNITY_CREATE_FIELDS_REQUIRED",
  "PUBLISH_BLOCKED_BY_VALIDATION",
  "QUESTION_NOT_FOUND",
  "WEIGHT_REFERENCE_NOT_FOUND",
]);

export async function requireAdminApiSession() {
  const session = await getCurrentAdminSession();
  if (!session) throw new AdminApiAuthenticationError();
  return session;
}

class AdminApiAuthenticationError extends Error {
  readonly status = 401;
  constructor() {
    super("ADMIN_UNAUTHENTICATED");
  }
}

export function adminApiError(error: unknown, options: { readOnly?: boolean } = {}) {
  if (
    error instanceof AdminApiAuthenticationError ||
    error instanceof AdminAuthorizationError ||
    error instanceof DraftConflictError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && safeOperationErrors.has(error.message)) {
    const status = error.message === "LAST_ACTIVE_ADMIN_PROTECTED" ? 409 : 422;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (
    options.readOnly &&
    error instanceof AdminDataApiError &&
    error.category === "TRANSPORT"
  ) {
    return NextResponse.json({ error: "ADMIN_READ_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json({ error: "ADMIN_OPERATION_FAILED" }, { status: 422 });
}
