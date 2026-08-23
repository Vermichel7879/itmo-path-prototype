import type { Metadata } from "next";
import { ResultClient } from "@/components/result/result-client";

export const metadata: Metadata = {
  title: "Твоя карьерная траектория — ИТМО",
};

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ configVersionId?: string }> }) {
  const { configVersionId } = await searchParams;
  return <ResultClient configVersionId={configVersionId ?? null} />;
}
