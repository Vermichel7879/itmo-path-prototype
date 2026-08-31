import type { PublicTrajectoryRecommendation } from "@/lib/rule-engine/types";

export function recommendationListClassName(count: number) {
  const columns = Math.max(1, Math.min(3, count));
  return `recommendation-list recommendation-list--${columns}`;
}

function recommendationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CKO_SERVICE: "Сервис Центра карьеры",
    EVENT: "Событие",
    CLUB: "Клуб",
    FACULTY: "Ресурс факультета",
    GENERAL: "Практический материал",
  };
  return labels[type] ?? type;
}

export function RecommendationCards({ recommendations }: { recommendations: PublicTrajectoryRecommendation[] }) {
  return (
    <section aria-labelledby="recommendations-title" className="result-block">
      <div className="result-block__heading">
        <h2 id="recommendations-title">Что может помочь прямо сейчас</h2>
      </div>
      <div className={recommendationListClassName(recommendations.length)}>
        {recommendations.map((recommendation, index) => (
          <details key={recommendation.id} className="recommendation-card group">
            <summary>
              <span className="recommendation-card__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="recommendation-card__copy">
                <strong>{recommendation.title}</strong>
                <span className="recommendation-card__type">{recommendationTypeLabel(recommendation.type)}</span>
              </span>
              <span className="recommendation-card__toggle group-open:hidden">Подробнее ↓</span>
              <span className="recommendation-card__toggle hidden group-open:inline">Скрыть ↑</span>
            </summary>
            <div className="recommendation-card__details">
              <p>{recommendation.description}</p>
              {recommendation.url ? <a className="recommendation-card__link" href={recommendation.url} target="_blank" rel="noreferrer">Открыть ресурс →</a> : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
