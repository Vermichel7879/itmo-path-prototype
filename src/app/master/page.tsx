import type { Metadata } from "next";

import { PublicEntryPage, type PublicEntryPageProps } from "@/components/questionnaire/public-entry-page";

export const metadata: Metadata = {
  title: "Карьерная траектория — Магистратура",
};

export default function MasterPage(props: Omit<PublicEntryPageProps, "educationLevel">) {
  return <PublicEntryPage {...props} educationLevel="MASTER" />;
}
