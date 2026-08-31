import type { Metadata } from "next";

import { PublicEntryPage, type PublicEntryPageProps } from "@/components/questionnaire/public-entry-page";

export const metadata: Metadata = {
  title: "Карьерная траектория — Бакалавриат",
};

export default function BachelorPage(props: Omit<PublicEntryPageProps, "educationLevel">) {
  return <PublicEntryPage {...props} educationLevel="BACHELOR" />;
}
