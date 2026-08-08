import type { FinalRoute } from "../game/routeBuilder";

export function ResultRoute({ route, routeNumber }: { route: FinalRoute; routeNumber: string }) {
  return (
    <>
      <h1>Твой маршрут</h1>
      <p className="route-number"><strong>Тестовый номер маршрута: {routeNumber}</strong><br />В рабочей версии номер будет использоваться при выдаче распечатки.</p>

      <section className="result-section">
        <h2>Программа</h2>
        <p>{route.programName}</p>
      </section>
      <section className="result-section">
        <h2>Карьерная цель</h2>
        <h3>{route.career.title}</h3>
        <p>{route.career.short_description}</p>
      </section>
      <section className="result-section">
        <h2>Ключевые навыки</h2>
        <ul>{route.skills.map((skill) => <li key={skill.skill_id}>{skill.title}</li>)}</ul>
      </section>

      <div className="year-grid">
        {route.years.map((year) => (
          <section className="result-section" key={year.year}>
            <h2>{year.year} курс</h2>
            <h3>Обязательная основа</h3>
            <ul>{year.mandatory.slice(0, 4).map((item) => <li key={item.discipline_id}>{item.name}</li>)}</ul>
            {year.highlights.length ? <><h3>Для выбранной траектории</h3><ul>{year.highlights.map((item) => <li key={item.discipline_id}>{item.name}</li>)}</ul></> : null}
            {year.decisions.length ? <><h3>Твои решения</h3><ul>{year.decisions.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
          </section>
        ))}
      </div>

      <section className="result-section">
        <h2>Твои карьерные шаги</h2>
        <ul>{route.actions.map((action) => <li key={action.action_id}><strong>{action.title}.</strong> {action.description}</li>)}</ul>
      </section>
      <section className="result-section">
        <h2>Что может пригодиться в Центре карьеры ИТМО</h2>
        <ul>{route.resources.map((resource) => <li key={resource.resource_id}>{resource.title}{resource.direct_url ? <> — <a href={resource.direct_url} target="_blank" rel="noreferrer">открыть ресурс</a></> : null}</li>)}</ul>
      </section>
      <section className="result-section">
        <h2>Рекомендации</h2>
        <ul>{route.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <p className="disclaimer">{route.disclaimer}</p>

      <section className="result-section">
        <h2>Сохранение маршрута</h2>
        <div className="placeholder-grid">
          <div className="placeholder"><h3>Отправка маршрута на почту</h3><button disabled>Отправить на почту</button><p>Будет реализовано в следующей версии. Недоступно в прототипе.</p></div>
          <div className="placeholder"><h3>Печать маршрута</h3><button disabled>Печать</button><p>Будет реализована в следующей версии. Недоступно в прототипе.</p></div>
        </div>
      </section>
    </>
  );
}
