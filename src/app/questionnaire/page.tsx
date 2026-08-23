import type { Metadata } from "next";
import { QuestionnaireClient } from "@/components/questionnaire/questionnaire-client";

export const metadata: Metadata = {
  title: "Анкета — Карьерная траектория ИТМО",
};

export default async function QuestionnairePage({ searchParams }: { searchParams: Promise<{ configVersionId?: string }> }) {
  const { configVersionId } = await searchParams;
  return <QuestionnaireClient initialConfigVersionId={configVersionId ?? null} />;
}
