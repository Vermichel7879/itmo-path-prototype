import type { EducationLevel } from "@/lib/career/audience";

export function publicEntryPath(educationLevel: EducationLevel) {
  return educationLevel === "BACHELOR" ? "/bachelor" : "/master";
}

export function publicEducationLabel(educationLevel: EducationLevel) {
  return educationLevel === "BACHELOR" ? "Бакалавриат" : "Магистратура";
}

export function unavailableQuestionnaireMessage(educationLevel: EducationLevel) {
  return educationLevel === "BACHELOR"
    ? "Анкета для бакалавриата пока не настроена."
    : "Анкета для магистратуры пока не настроена.";
}

export function trajectorySessionStartPayload(
  isu: FormDataEntryValue | null,
  educationLevel: EducationLevel,
) {
  return { isu: String(isu ?? ""), educationLevel };
}
