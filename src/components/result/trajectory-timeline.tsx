interface TrajectoryTimelineProps {
  steps: [string, string, string];
  checkpoint: string;
}

export function TrajectoryTimeline({ steps, checkpoint }: TrajectoryTimelineProps) {
  return (
    <section aria-labelledby="trajectory-title" className="result-block result-route">
      <div className="result-block__heading">
        <h2 id="trajectory-title">
          Три шага на ближайшие недели
        </h2>
      </div>

      <div className="trajectory">
        <div className="trajectory__line" aria-hidden="true" />
        <div className="trajectory__item trajectory__item--now">
          <span className="trajectory__marker trajectory__marker--solid" aria-hidden="true" />
          <p className="trajectory__status">Сейчас</p>
        </div>
        {steps.map((step, index) => (
          <div key={step} className="trajectory__item">
            <span className="trajectory__marker" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="trajectory__step-label">Шаг {String(index + 1).padStart(2, "0")}</p>
              <h3>
                {step}
              </h3>
            </div>
          </div>
        ))}
        <div className="trajectory__item trajectory__item--checkpoint">
          <span className="trajectory__marker trajectory__marker--checkpoint" aria-hidden="true" />
          <div className="trajectory__checkpoint-copy">
            <p className="trajectory__step-label">Через 2–4 недели</p>
            <p>{checkpoint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
