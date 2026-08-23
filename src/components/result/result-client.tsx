"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareerJourney } from "@/components/journey/career-journey-provider";
import { SiteHeader } from "@/components/ui/site-header";
import { Toast } from "@/components/ui/toast";
import { calculateMockTrajectory } from "@/lib/mock-rule-engine";
import { RecommendationCards } from "./recommendation-cards";
import { SupportModules } from "./support-modules";
import { TrajectoryTimeline } from "./trajectory-timeline";

export function ResultClient() {
  const router = useRouter();
  const { answers, hydrated, resetJourney } = useCareerJourney();
  const [showPdfToast, setShowPdfToast] = useState(false);
  const result = useMemo(() => calculateMockTrajectory(answers), [answers]);
  const dismissPdfToast = useCallback(() => setShowPdfToast(false), []);

  useEffect(() => {
    if (hydrated && !answers.Q1?.length) router.replace("/questionnaire");
  }, [answers.Q1, hydrated, router]);

  function restart() {
    resetJourney();
    router.push("/");
  }

  if (!hydrated || !answers.Q1?.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Открываем результат…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <SiteHeader
        right={
          <button type="button" onClick={restart} className="restart-button">
            Пройти заново
          </button>
        }
      />
      <main className="page-enter mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-[14px] bg-blue-700 px-6 py-9 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-blue-100">Твоя карьерная траектория</p>
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold">
              Главный фокус
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.6rem] font-semibold leading-none tracking-[-0.05em] sm:text-[4.4rem]">
            {result.primary.name}
          </h1>
          <div className="mt-8 max-w-3xl border-t border-white/20 pt-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-200">Точка А</p>
            <p className="mt-3 text-base leading-7 text-blue-50 sm:text-lg">{result.pointA}</p>
          </div>
          {result.priorities.length ? (
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-200">Для тебя важно</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.priorities.map((priority) => (
                  <span key={priority} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-blue-800">
                    {priority}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <div className="order-2 space-y-8 lg:order-1">
            <TrajectoryTimeline steps={result.steps} checkpoint={result.checkpoint} />
            <SupportModules modules={result.supports} />
            <RecommendationCards recommendations={result.recommendations} />
          </div>

          <aside className="order-1 lg:sticky lg:top-6 lg:order-2" aria-label="Краткое резюме траектории">
            <div className="summary-card">
              <h2 className="text-lg font-semibold text-zinc-950">Твоя траектория</h2>
              <dl className="mt-6 space-y-5">
                <div>
                  <dt className="summary-card__label">Главный фокус</dt>
                  <dd className="mt-1 font-semibold text-zinc-950">{result.primary.name}</dd>
                </div>
                <div>
                  <dt className="summary-card__label">Дополнительно</dt>
                  <dd className="mt-1 text-sm leading-6 text-zinc-700">
                    {result.supports.length ? result.supports.map((module) => module.name).join(" · ") : "Не требуется"}
                  </dd>
                </div>
                <div>
                  <dt className="summary-card__label">Темп</dt>
                  <dd className="mt-1 font-semibold text-zinc-950">{result.pace.label}</dd>
                  <dd className="mt-1 text-sm leading-5 text-zinc-600">{result.pace.description}</dd>
                </div>
                <div>
                  <dt className="summary-card__label">Ориентиры</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {result.priorities.map((priority) => (
                      <span key={priority} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                        {priority}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <button type="button" onClick={() => setShowPdfToast(true)} className="button-secondary mt-7 w-full">
                Скачать PDF
              </button>
              <p className="mt-2 text-center text-xs leading-5 text-zinc-500">PDF будет доступен в следующей версии</p>
            </div>
          </aside>
        </div>
      </main>

      {showPdfToast ? (
        <Toast
          title="PDF пока не подключён"
          message="Он будет доступен в следующей версии. Сейчас результат можно посмотреть на этой странице."
          onDismiss={dismissPdfToast}
        />
      ) : null}
    </div>
  );
}
