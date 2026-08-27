import type { PublicTrajectoryRecommendation } from "@/lib/rule-engine/types";

export function RecommendationCards({ recommendations }: { recommendations: PublicTrajectoryRecommendation[] }) {
  return (
    <section aria-labelledby="recommendations-title" className="result-block">
      <div className="result-block__heading">
        <h2 id="recommendations-title">Что может помочь прямо сейчас</h2>
      </div>
      <div className="recommendation-list">
        {recommendations.map((recommendation, index) => (
          <details key={recommendation.id} className="recommendation-card group">
            <summary>
              <span className="recommendation-card__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="recommendation-card__copy">
                <strong>{recommendation.title}</strong>
                <span>{recommendation.description}</span>
              </span>
              <span className="recommendation-card__toggle group-open:hidden">Подробнее ↓</span>
              <span className="recommendation-card__toggle hidden group-open:inline">Свернуть ↑</span>
            </summary>
            {recommendation.url ? <a className="recommendation-card__link" href={recommendation.url} target="_blank" rel="noreferrer">Открыть ресурс →</a> : null}
          </details>
        ))}
      </div>
    </section>
  );
}
