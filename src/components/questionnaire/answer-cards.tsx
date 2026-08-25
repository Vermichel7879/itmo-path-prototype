import type { PublicQuestionnaireQuestion } from "@/lib/public-config/questionnaire";

interface AnswerCardsProps {
  question: PublicQuestionnaireQuestion;
  selected: string[];
  onToggle: (answerId: string) => void;
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
      <path d="m4.5 10.5 3.2 3.2 7.8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AnswerCards({ question, selected, onToggle }: AnswerCardsProps) {
  const reachedLimit = question.type === "multi" && selected.length >= question.maxSelect;

  return (
    <fieldset aria-describedby={`${question.id}-instruction`}>
      <legend className="sr-only">{question.title}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {question.answers.map((answer) => {
          const isSelected = selected.includes(answer.id);
          const isDisabled = reachedLimit && !isSelected;
          const inputId = `${question.id}-${answer.id}`;

          return (
            <label
              key={answer.id}
              htmlFor={inputId}
              className={`answer-card ${isSelected ? "answer-card--selected" : ""} ${
                isDisabled ? "answer-card--disabled" : ""
              }`}
              aria-disabled={isDisabled}
            >
              <input
                id={inputId}
                name={question.id}
                type={question.type === "single" ? "radio" : "checkbox"}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onToggle(answer.id)}
                className="sr-only"
              />
              <span className="min-w-0 pr-3 text-[0.98rem] leading-6">{answer.text}</span>
              <span
                className={`answer-card__indicator ${isSelected ? "answer-card__indicator--selected" : ""}`}
                aria-hidden="true"
              >
                {isSelected ? <CheckIcon /> : null}
              </span>
              <span className="sr-only">{isSelected ? "Выбрано" : "Не выбрано"}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
