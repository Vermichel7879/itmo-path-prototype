import type { FormEventHandler } from "react";
import { SiteHeader } from "@/components/ui/site-header";

const routeStops = [
  {
    number: "01",
    title: "Ответь",
    description: "Коротко опиши текущую ситуацию, сложности и ближайшую цель.",
  },
  {
    number: "02",
    title: "Определи фокус",
    description: "Увидь одно главное направление без процентов и скрытых оценок.",
  },
  {
    number: "03",
    title: "Начни действовать",
    description: "Получишь три шага и контрольную точку на ближайшие 2–4 недели.",
  },
] as const;

function RouteManifest() {
  return (
    <ol className="landing-route" aria-label="Как строится карьерная траектория">
      {routeStops.map((stop) => (
        <li key={stop.number} className="landing-route__stop">
          <span className="landing-route__marker" aria-hidden="true" />
          <span className="landing-route__number">{stop.number}</span>
          <div className="landing-route__copy">
            <h2>{stop.title}</h2>
            <p>{stop.description}</p>
          </div>
        </li>
      ))}
      <li className="landing-route__finish">
        <span className="landing-route__marker landing-route__marker--finish" aria-hidden="true" />
        <span>Контрольная точка</span>
        <strong>2–4 недели</strong>
      </li>
    </ol>
  );
}

export function LandingPage({
  onStart,
  starting,
  startError,
}: {
  onStart: FormEventHandler<HTMLFormElement>;
  starting: boolean;
  startError: boolean;
}) {
  return (
    <div className="public-shell landing-page">
      <SiteHeader />
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero__copy page-enter">
            <h1>
              Построй свою карьерную траекторию
            </h1>
            <p className="landing-hero__lead">
              Ответь на несколько вопросов о своей ситуации, получи главный карьерный фокус,
              ближайшие действия и подходящие возможности ИТМО.
            </p>
            <form className="landing-start" onSubmit={onStart}>
              <label className="landing-start__field">
                <span>Номер ИСУ</span>
                <input name="isu" inputMode="numeric" pattern="[0-9]+" required autoComplete="off" />
              </label>
              {startError ? <p className="landing-start__error" role="alert">Не удалось начать прохождение. Попробуйте ещё раз.</p> : null}
              <div className="landing-hero__action">
                <button type="submit" className="button-primary button-primary--large route-button" disabled={starting}>
                  <span>{starting ? "Начинаем…" : "Построить траекторию"}</span>
                  <span className="route-button__arrow" aria-hidden="true">→</span>
                </button>
                <p>≈ 3 минуты<br />8 основных вопросов</p>
              </div>
            </form>
          </div>
          <div className="landing-hero__route page-enter">
            <div className="landing-hero__route-meta">
              <span>Старт</span>
              <span>Следующий шаг</span>
            </div>
            <RouteManifest />
          </div>
        </section>
        <footer className="landing-footer">
          <p>Центр карьеры ИТМО</p>
          <p>Не тест и не оценка. Практический маршрут для следующего карьерного шага.</p>
        </footer>
      </main>
    </div>
  );
}
