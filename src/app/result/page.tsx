import type { Metadata } from "next";
import { ResultClient } from "@/components/result/result-client";

export const metadata: Metadata = {
  title: "Твоя карьерная траектория — ИТМО",
};

export default function ResultPage() {
  return <ResultClient />;
}
