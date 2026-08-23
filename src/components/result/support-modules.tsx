import type { PublicTrajectoryModule } from "@/lib/rule-engine/types";

export function SupportModules({ modules }: { modules: PublicTrajectoryModule[] }) {
  if (modules.length === 0) return null;

  return (
    <section aria-labelledby="support-title" className="result-section">
      <p className="eyebrow">Дополнительные опоры</p>
      <h2 id="support-title" className="result-section__title">
        Что ещё поможет двигаться быстрее
      </h2>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {modules.map((module) => (
          <details key={module.id} className="support-card group">
            <summary className="cursor-pointer list-none focus-visible:outline-3 focus-visible:outline-blue-600">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Поддерживающий фокус
                  </p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">{module.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{module.goal}</p>
                </div>
                <span className="support-card__plus" aria-hidden="true">+</span>
              </div>
              <span className="mt-5 inline-block text-sm font-semibold text-blue-700 group-open:hidden">Подробнее ↓</span>
              <span className="mt-5 hidden text-sm font-semibold text-blue-700 group-open:inline-block">Свернуть ↑</span>
            </summary>
            <ul className="mt-5 space-y-3 border-t border-zinc-200 pt-5">
              {module.steps.slice(0, 2).map((step) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-zinc-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
