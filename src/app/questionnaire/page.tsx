import { redirect } from "next/navigation";

export default async function QuestionnairePage({ searchParams }: { searchParams: Promise<{ configVersionId?: string }> }) {
  const { configVersionId } = await searchParams;
  redirect(configVersionId ? `/master?configVersionId=${encodeURIComponent(configVersionId)}` : "/master");
}
