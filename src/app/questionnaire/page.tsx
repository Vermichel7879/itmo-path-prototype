import type { Metadata } from "next";
import { QuestionnaireClient } from "@/components/questionnaire/questionnaire-client";

export const metadata: Metadata = {
  title: "Анкета — Карьерная траектория ИТМО",
};

export default function QuestionnairePage() {
  return <QuestionnaireClient />;
}
