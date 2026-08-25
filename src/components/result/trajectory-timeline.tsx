interface TrajectoryTimelineProps {
  steps: [string, string, string];
  checkpoint: string;
}

export function TrajectoryTimeline({ steps, checkpoint }: TrajectoryTimelineProps) {
  return (
    <section aria-labelledby="trajectory-title" className="result-section">
      <div className="mb-8">
        <p className="eyebrow">Твоя траектория</p>
        <h2 id="trajectory-title" className="result-section__title">
          Три шага на ближайшие недели
        </h2>
      </div>

      <div className="trajectory">
        <div className="trajectory__line" aria-hidden="true" />
        <div className="trajectory__item trajectory__item--now">
          <span className="trajectory__marker trajectory__marker--solid" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Сейчас</p>
        </div>
        {steps.map((step, index) => (
          <div key={step} className="trajectory__item">
            <span className="trajectory__marker" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                Шаг {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 max-w-2xl text-lg font-semibold leading-7 text-zinc-950 sm:text-xl">
                {step}
              </h3>
            </div>
          </div>
        ))}
        <div className="trajectory__item trajectory__item--checkpoint">
          <span className="trajectory__marker trajectory__marker--checkpoint" aria-hidden="true" />
          <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Через 2–4 недели</p>
            <p className="mt-2 text-base font-medium leading-7 text-zinc-950">{checkpoint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
