import type { FormEventHandler } from "react";
import { SiteHeader } from "@/components/ui/site-header";

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
              Ответь на несколько вопросов о себе и своей готовности к поиску работы. Так ты
              определишь главный карьерный фокус, наметишь ближайшие действия и узнаешь о
              подходящих возможностях ИТМО.
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
        </section>
        <footer className="landing-footer">
          <p>Центр карьеры ИТМО</p>
          <p>Не тест и не оценка. Практический маршрут для следующего карьерного шага.</p>
        </footer>
      </main>
    </div>
  );
}
