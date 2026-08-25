import { validatePublishableCareerSnapshot } from "@/lib/db/publish/publish-validation";

export interface DraftValidationIssue {
  severity: "ERROR" | "WARNING";
  code: string;
  entity: string | null;
  field: string | null;
  message: string;
}

export interface DraftValidationResult {
  valid: boolean;
  issues: DraftValidationIssue[];
}

export function validateDraftCareerConfig(input: unknown): DraftValidationResult {
  const issues: DraftValidationIssue[] = [];
  try {
    const config = validatePublishableCareerSnapshot(input);
    if (!config.opportunities.some((item) => item.active)) {
      issues.push({
        severity: "WARNING",
        code: "NO_ACTIVE_OPPORTUNITIES",
        entity: "opportunities",
        field: "active",
        message: "Нет активных возможностей; системные слоты будут исключены.",
      });
    }
  } catch (error) {
    issues.push({
      severity: "ERROR",
      code: "INVALID_TYPED_CONFIG",
      entity: null,
      field: null,
      message: error instanceof Error ? error.message : "Конфигурация невалидна",
    });
  }
  return {
    valid: !issues.some((issue) => issue.severity === "ERROR"),
    issues,
  };
}
