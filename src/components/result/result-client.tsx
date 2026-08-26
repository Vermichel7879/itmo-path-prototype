"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareerJourney } from "@/components/journey/career-journey-provider";
import { SiteHeader } from "@/components/ui/site-header";
import { Toast } from "@/components/ui/toast";
import type { TrajectoryResult } from "@/lib/rule-engine/types";
import { RecommendationCards } from "./recommendation-cards";
import { SupportModules } from "./support-modules";
import { TrajectoryTimeline } from "./trajectory-timeline";

export function ResultClient({ configVersionId }: { configVersionId: string | null }) {
  const router = useRouter();
  const journey = useCareerJourney();
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState(false);
  const requestedVersion = useRef<string | null>(null);
  const { initializeVersion, setTrajectoryResult } = journey;
  const dismissPdfToast = useCallback(() => setPdfState("idle"), []);

  useEffect(() => {
    if (!configVersionId) router.replace("/questionnaire");
    else initializeVersion(configVersionId);
  }, [configVersionId, initializeVersion, router]);

  useEffect(() => {
    if (!journey.hydrated || !configVersionId || journey.configVersionId !== configVersionId) return;
    if (!journey.answers.Q1?.length) {
      router.replace("/questionnaire");
      return;
    }
    if (journey.result?.configVersionId === configVersionId || requestedVersion.current === configVersionId) return;
    requestedVersion.current = configVersionId;
    fetch("/api/trajectory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ configVersionId, selectedAnswerIds: Object.values(journey.answers).flat() }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("TRAJECTORY_UNAVAILABLE");
        return (await response.json()) as TrajectoryResult;
      })
      .then((result) => setTrajectoryResult(result))
      .catch(() => setLoadError(true))
      .finally(() => { requestedVersion.current = null; });
  }, [configVersionId, journey.answers, journey.configVersionId, journey.hydrated, journey.result, router, setTrajectoryResult]);

  function restart() {
    journey.resetJourney();
    router.push("/");
  }

  const result = journey.result?.configVersionId === configVersionId ? journey.result : null;

  async function downloadPdf() {
    if (!result || pdfState === "loading") return;
    setPdfState("loading");
    try {
      const { renderTrajectoryPdfBlob } = await import(
        "@/lib/pdf/trajectory-pdf-browser"
      );
      const objectUrl = URL.createObjectURL(
        await renderTrajectoryPdfBlob(result),
      );
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `career-trajectory-${result.primaryModule.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setPdfState("idle");
    } catch {
      setPdfState("error");
    }
  }

  if (loadError) return <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 text-center"><div><p className="text-zinc-700">Не удалось открыть результат.</p><button type="button" className="button-secondary mt-5" onClick={() => router.replace("/questionnaire")}>Вернуться к анкете</button></div></main>;
  if (!journey.hydrated || !result) return <main className="flex min-h-screen items-center justify-center bg-zinc-50"><p className="text-sm text-zinc-500">Открываем результат…</p></main>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <SiteHeader right={<button type="button" onClick={restart} className="restart-button">Пройти заново</button>} />
      <main className="page-enter mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-[14px] bg-blue-700 px-6 py-9 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-blue-100">Твоя карьерная траектория</p><span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold">Главный фокус</span></div>
          <h1 className="mt-5 max-w-4xl text-[2.6rem] font-semibold leading-none tracking-[-0.05em] sm:text-[4.4rem]">{result.primaryModule.name}</h1>
          <div className="mt-8 max-w-3xl border-t border-white/20 pt-6"><p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-200">Точка А</p><p className="mt-3 text-base leading-7 text-blue-50 sm:text-lg">{result.currentPoint}</p></div>
          {result.priorities.length ? <div className="mt-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-200">Для тебя важно</p><div className="mt-3 flex flex-wrap gap-2">{result.priorities.map((priority) => <span key={priority} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-blue-800">{priority}</span>)}</div></div> : null}
        </section>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <div className="order-2 space-y-8 lg:order-1">
            <TrajectoryTimeline steps={result.steps} checkpoint={result.checkpoint} />
            {result.adjustments.length ? <section className="result-section"><p className="eyebrow">Уточнения</p><h2 className="result-section__title">Что учесть в движении</h2><ul className="mt-6 space-y-3">{result.adjustments.map((item) => <li key={item} className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">{item}</li>)}</ul></section> : null}
            <SupportModules modules={result.supportModules} />
            <RecommendationCards recommendations={result.recommendations} />
          </div>
          <aside className="order-1 lg:sticky lg:top-6 lg:order-2" aria-label="Краткое резюме траектории"><div className="summary-card"><h2 className="text-lg font-semibold text-zinc-950">Твоя траектория</h2><dl className="mt-6 space-y-5"><div><dt className="summary-card__label">Главный фокус</dt><dd className="mt-1 font-semibold text-zinc-950">{result.primaryModule.name}</dd></div><div><dt className="summary-card__label">Дополнительно</dt><dd className="mt-1 text-sm leading-6 text-zinc-700">{result.supportModules.length ? result.supportModules.map((module) => module.name).join(" · ") : "Не требуется"}</dd></div><div><dt className="summary-card__label">Темп</dt><dd className="mt-1 font-semibold text-zinc-950">{result.pace?.text ?? "Не указан"}</dd></div><div><dt className="summary-card__label">Ориентиры</dt><dd className="mt-2 flex flex-wrap gap-1.5">{result.priorities.map((priority) => <span key={priority} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{priority}</span>)}</dd></div></dl><button type="button" onClick={downloadPdf} disabled={pdfState === "loading"} className="button-primary mt-7 w-full">{pdfState === "loading" ? "Готовим PDF…" : "Скачать PDF"}</button><p className="mt-2 text-center text-xs leading-5 text-zinc-500">A4 · 3 страницы · готово к печати</p></div></aside>
        </div>
        <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-6 text-zinc-500">{result.disclaimer}</p>
      </main>
      {pdfState === "error" ? <Toast title="Не удалось скачать PDF" message="Попробуйте ещё раз. Текущий результат останется на странице." onDismiss={dismissPdfToast} /> : null}
    </div>
  );
}
