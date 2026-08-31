import type { EducationLevel } from "@/lib/career/audience";
import { QuestionnaireClient } from "./questionnaire-client";

export interface PublicEntryPageProps {
  educationLevel: EducationLevel;
  searchParams: Promise<{ configVersionId?: string }>;
}

export async function PublicEntryPage({ educationLevel, searchParams }: PublicEntryPageProps) {
  const { configVersionId } = await searchParams;
  return (
    <QuestionnaireClient
      educationLevel={educationLevel}
      initialConfigVersionId={configVersionId ?? null}
    />
  );
}
