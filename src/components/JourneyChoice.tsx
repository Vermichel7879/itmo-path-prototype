import type { ProgramDatabase } from "../types/program";
import type { JourneyOption, JourneyStep } from "../types/journey";

interface Props {
  program: ProgramDatabase;
  step: JourneyStep;
  selected: string | null;
  selectedCareerId: string | null;
  onSelect: (option: JourneyOption) => void;
}

export function JourneyChoice({ program, step, selected, selectedCareerId, onSelect }: Props) {
  const disciplineById = new Map(program.disciplines.map((discipline) => [discipline.discipline_id, discipline]));
  const selectedOption = step.options?.find((option) => option.option_id === selected);
  const selectedCareer = program.careers.find((career) => career.career_id === selectedCareerId);
  const recommended = step.options?.find((option) => selectedCareerId && option.recommended_for_career_refs?.includes(selectedCareerId));

  return (
    <section className={step.type === "career_center_situation" ? "screen career-center-step" : "screen"}>
      <p className="eyebrow">{step.semester ? `${step.semester} семестр` : "Выбор"}</p>
      <h1>{step.title}</h1>
      {step.intro ? <p className="hint">{step.intro}</p> : null}
      {recommended && selectedCareer ? (
        <aside className="recommendation-box">
          <strong>Рекомендация для цели «{selectedCareer.title}»</strong>
          <p>{recommended.title}. {recommended.recommendation_reason}</p>
        </aside>
      ) : null}
      <div className="choice-cards">
        {(step.options ?? []).map((option) => {
          const isRecommended = Boolean(selectedCareerId && option.recommended_for_career_refs?.includes(selectedCareerId));
          const disciplines = (option.discipline_refs ?? []).map((id) => disciplineById.get(id)).filter(Boolean);
          return (
            <button type="button" className={selected === option.option_id ? "journey-choice selected" : "journey-choice"} key={option.option_id} onClick={() => onSelect(option)}>
              <strong>{option.title}</strong>
              {option.description ? <span>{option.description}</span> : null}
              {disciplines.length ? <small>Реальные дисциплины: {disciplines.map((item) => item!.name).join(", ")}</small> : null}
              {option.learning_benefit ? <small>{option.learning_benefit}</small> : null}
              {isRecommended ? <small className="recommendation">Рекомендуется для выбранной карьерной цели</small> : null}
            </button>
          );
        })}
      </div>
      {step.type === "career_center_situation" && selectedOption ? (
        <aside className="career-center-answer">
          <h2>Как именно может помочь ЦКО</h2>
          <p>{selectedOption.outcome}</p>
          {selectedCareerId && selectedOption.outcome_by_career?.[selectedCareerId] ? <p>{selectedOption.outcome_by_career[selectedCareerId]}</p> : null}
        </aside>
      ) : null}
    </section>
  );
}
