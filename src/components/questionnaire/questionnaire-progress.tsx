interface QuestionnaireProgressProps {
  current: number;
  total: number;
  entrepreneurshipRevealed: boolean;
}

export function QuestionnaireProgress({
  current,
  total,
  entrepreneurshipRevealed,
}: QuestionnaireProgressProps) {
  const baseProgress = Math.min(current, 8) / 8;
  const entrepreneurProgress = Math.max(0, current - 8) / 2;

  return (
    <div aria-label={`Пройдено вопросов: ${current - 1} из ${total}`}>
      <div className={`progress-grid ${entrepreneurshipRevealed ? "progress-grid--expanded" : ""}`}>
        <div>
          <div className="progress-track">
            <span className="progress-fill" style={{ transform: `scaleX(${baseProgress})` }} />
          </div>
        </div>
        {entrepreneurshipRevealed ? (
          <div className="progress-entrepreneur">
            <div className="progress-track progress-track--entrepreneur">
              <span
                className="progress-fill progress-fill--entrepreneur"
                style={{ transform: `scaleX(${entrepreneurProgress})` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      {entrepreneurshipRevealed ? (
        <div className="mt-2 flex justify-end text-xs font-medium text-blue-700">
          Предпринимательство · 2 вопроса
        </div>
      ) : null}
    </div>
  );
}
