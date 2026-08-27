import type { PublicQuestionnaireQuestion } from "@/lib/public-config/questionnaire";

interface AnswerCardsProps {
  question: PublicQuestionnaireQuestion;
  selected: string[];
  onToggle: (answerId: string) => void;
}

export function AnswerCards({ question, selected, onToggle }: AnswerCardsProps) {
  const reachedLimit = question.type === "multi" && selected.length >= question.maxSelect;

  return (
    <fieldset aria-describedby={`${question.id}-instruction`}>
      <legend className="sr-only">{question.title}</legend>
      <div className="answer-list">
        {question.answers.map((answer) => {
          const isSelected = selected.includes(answer.id);
          const isDisabled = reachedLimit && !isSelected;
          const inputId = `${question.id}-${answer.id}`;

          return (
            <label
              key={answer.id}
              htmlFor={inputId}
              className={`answer-row ${isSelected ? "answer-row--selected" : ""} ${
                isDisabled ? "answer-row--disabled" : ""
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
              <span className="answer-row__text">{answer.text}</span>
              <span className="answer-row__control" aria-hidden="true" />
              <span className="sr-only">{isSelected ? "Выбрано" : "Не выбрано"}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
