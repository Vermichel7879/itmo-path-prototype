interface QuestionnaireProgressProps {
  current: number;
  total: number;
}

export function QuestionnaireProgress({
  current,
  total,
}: QuestionnaireProgressProps) {
  const progress = Math.max(0, Math.min(100, ((current - 1) / total) * 100));

  return (
    <div className="question-progress" aria-label={`Пройдено вопросов: ${current - 1} из ${total}`}>
      <div className="question-progress__track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
