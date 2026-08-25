import type { PublicTrajectoryRecommendation } from "@/lib/rule-engine/types";

export function RecommendationCards({ recommendations }: { recommendations: PublicTrajectoryRecommendation[] }) {
  return (
    <section aria-labelledby="recommendations-title" className="result-section">
      <p className="eyebrow">Рекомендации</p>
      <h2 id="recommendations-title" className="result-section__title">
        Что может помочь прямо сейчас
      </h2>
      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <details key={recommendation.id} className="recommendation-card group">
            <summary className="flex h-full cursor-pointer list-none flex-col focus-visible:outline-3 focus-visible:outline-blue-600">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                {recommendation.type}
              </p>
              <h3 className="mt-4 text-lg font-semibold leading-6 text-zinc-950">{recommendation.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600">{recommendation.description}</p>
              <span className="mt-6 text-sm font-semibold text-blue-700 group-open:hidden">Подробнее →</span>
              <span className="mt-6 hidden text-sm font-semibold text-blue-700 group-open:inline">Свернуть ↑</span>
            </summary>
            {recommendation.url ? <a className="mt-4 inline-block border-t border-blue-100 pt-4 text-sm font-semibold text-blue-700" href={recommendation.url} target="_blank" rel="noreferrer">Открыть ресурс →</a> : null}
          </details>
        ))}
      </div>
    </section>
  );
}
