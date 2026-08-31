"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareerJourney } from "@/components/journey/career-journey-provider";
import { SiteHeader } from "@/components/ui/site-header";
import { Toast } from "@/components/ui/toast";
import type { TrajectoryResult } from "@/lib/rule-engine/types";
import { publicEntryPath } from "@/lib/public-flow/entry";
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
  const entryPath = publicEntryPath(journey.educationLevel ?? "MASTER");

  useEffect(() => {
    if (!configVersionId) router.replace(entryPath);
    else initializeVersion(configVersionId);
  }, [configVersionId, entryPath, initializeVersion, router]);

  useEffect(() => {
    if (!journey.hydrated || !configVersionId || journey.configVersionId !== configVersionId) return;
    if (!journey.answers.Q1?.length) {
      router.replace(entryPath);
      return;
    }
    if (journey.result?.configVersionId === configVersionId || requestedVersion.current === configVersionId) return;
    requestedVersion.current = configVersionId;
    fetch("/api/trajectory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: journey.sessionId, configVersionId, selectedAnswerIds: Object.values(journey.answers).flat() }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("TRAJECTORY_UNAVAILABLE");
        return (await response.json()) as TrajectoryResult;
      })
      .then((result) => setTrajectoryResult(result))
      .catch(() => setLoadError(true))
      .finally(() => { requestedVersion.current = null; });
  }, [configVersionId, entryPath, journey.answers, journey.configVersionId, journey.hydrated, journey.result, journey.sessionId, router, setTrajectoryResult]);

  function restart() {
    journey.resetJourney();
    router.push(entryPath);
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

  if (loadError) return <main className="public-shell route-status"><div><p>Не удалось открыть результат.</p><button type="button" className="button-secondary" onClick={() => router.replace(entryPath)}>Вернуться к анкете</button></div></main>;
  if (!journey.hydrated || !result) return <main className="public-shell route-status"><p>Открываем результат…</p></main>;

  return (
    <div className="public-shell result-page">
      <SiteHeader right={<button type="button" onClick={restart} className="restart-button">Пройти заново</button>} />
      <main className="result-main page-enter">
        <section className="result-hero">
          <div className="result-hero__title">
            <p>Главный фокус</p>
            <h1>{result.primaryModule.name}</h1>
          </div>
          <div className="result-hero__context">
            <div className="result-hero__point">
              <p className="result-hero__label">Сейчас</p>
              <p>{result.currentPoint}</p>
            </div>
            {result.priorities.length ? (
              <div className="result-hero__priorities">
                <p className="result-hero__label">Ориентиры</p>
                <ul>{result.priorities.map((priority) => <li key={priority}>{priority}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </section>
        <div className="result-layout">
          <div className="result-content">
            <TrajectoryTimeline steps={result.steps} checkpoint={result.checkpoint} />
            {result.adjustments.length ? (
              <section className="result-block result-adjustments">
                <div className="result-block__heading"><h2>Что учесть в движении</h2></div>
                <ul className="adjustment-list">{result.adjustments.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ul>
              </section>
            ) : null}
            <SupportModules modules={result.supportModules} />
            <RecommendationCards recommendations={result.recommendations} />
          </div>
          <aside className="result-summary" aria-label="Краткое резюме траектории">
            <h2>Кратко</h2>
            <dl>
              <div><dt>Главный фокус</dt><dd>{result.primaryModule.name}</dd></div>
              <div><dt>Дополнительно</dt><dd>{result.supportModules.length ? result.supportModules.map((module) => module.name).join(" · ") : "Не требуется"}</dd></div>
              <div><dt>Темп</dt><dd>{result.pace?.text ?? "Не указан"}</dd></div>
              <div><dt>Ориентиры</dt><dd>{result.priorities.join(" · ")}</dd></div>
            </dl>
            <button type="button" onClick={downloadPdf} disabled={pdfState === "loading"} className="button-primary">{pdfState === "loading" ? "Готовим PDF…" : "Скачать PDF"}</button>
            <p className="result-summary__pdf-note">A4 / 3 страницы / готово к печати</p>
          </aside>
        </div>
        <p className="result-disclaimer">{result.disclaimer}</p>
      </main>
      {pdfState === "error" ? <Toast title="Не удалось скачать PDF" message="Попробуйте ещё раз. Текущий результат останется на странице." onDismiss={dismissPdfToast} /> : null}
    </div>
  );
}
