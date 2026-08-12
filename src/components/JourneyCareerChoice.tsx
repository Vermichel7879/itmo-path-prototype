import { useState } from "react";
import type { ProgramDatabase } from "../types/program";
import type { JourneyStep } from "../types/journey";

interface Props {
  program: ProgramDatabase;
  step: JourneyStep;
  selected: string | null;
  onSelect: (careerId: string) => void;
}

export function JourneyCareerChoice({ program, step, selected, onSelect }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const disciplineById = new Map(program.disciplines.map((discipline) => [discipline.discipline_id, discipline]));

  return (
    <section className="screen">
      <p className="eyebrow">Карьерная цель</p>
      <h1>{step.title}</h1>
      {step.intro ? <p className="hint">{step.intro}</p> : null}
      <div className="card-grid">
        {(step.career_refs ?? []).map((careerId) => {
          const career = program.careers.find((item) => item.career_id === careerId);
          const details = step.career_details?.find((item) => item.career_ref === careerId);
          if (!career) return null;
          const isExpanded = expanded === careerId;
          return (
            <article className={selected === careerId ? "card career-card selected" : "card career-card"} key={careerId}>
              <h2>{career.title}</h2>
              <p>{career.short_description}</p>
              <button type="button" className="link-button details-toggle" onClick={() => setExpanded(isExpanded ? null : careerId)}>
                {isExpanded ? "Скрыть" : "Подробнее"}
              </button>
              {isExpanded && details ? (
                <div className="career-detail-sections">
                  <section><h3>Чем занимается</h3><ul>{details.daily_tasks.map((item) => <li key={item}>{item}</li>)}</ul></section>
                  <section><h3>Что создаёт</h3><ul>{details.creates.map((item) => <li key={item}>{item}</li>)}</ul></section>
                  <section><h3>Задачи начинающего</h3><ul>{details.beginner_tasks.map((item) => <li key={item}>{item}</li>)}</ul></section>
                  <section className="career-disciplines"><h3>Связанные дисциплины</h3><p>{details.related_discipline_refs.map((id) => disciplineById.get(id)?.name).filter(Boolean).join(", ")}.</p></section>
                </div>
              ) : null}
              <button type="button" className={selected === careerId ? "secondary" : ""} onClick={() => onSelect(careerId)}>
                {selected === careerId ? "Выбрано" : "Выбрать профессию"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
