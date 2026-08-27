import type { PublicTrajectoryModule } from "@/lib/rule-engine/types";

export function SupportModules({ modules }: { modules: PublicTrajectoryModule[] }) {
  if (modules.length === 0) return null;

  return (
    <section aria-labelledby="support-title" className="result-block">
      <div className="result-block__heading">
        <h2 id="support-title">Что ещё поможет двигаться быстрее</h2>
      </div>
      <div className="support-list">
        {modules.map((module) => (
          <details key={module.id} className="support-card group">
            <summary>
              <div className="support-card__copy">
                <h3>{module.name}</h3>
                <p>{module.goal}</p>
              </div>
              <span className="support-card__toggle group-open:hidden">Подробнее ↓</span>
              <span className="support-card__toggle hidden group-open:inline">Свернуть ↑</span>
            </summary>
            <ul className="support-card__steps">
              {module.steps.slice(0, 2).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
