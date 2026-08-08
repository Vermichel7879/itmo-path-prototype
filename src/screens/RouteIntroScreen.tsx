import { Timeline } from "../components/Timeline";
import type { ProgramDatabase } from "../types/program";

export function RouteIntroScreen({ program }: { program: ProgramDatabase }) {
  return (
    <section className="screen">
      <h1>Твой маршрут</h1>
      <Timeline timeline={program.timeline} />
      <div className="info-box">
        <p>Обязательные дисциплины уже входят в программу.</p>
        <p>По ходу обучения ты примешь несколько решений, которые могут быть особенно полезны для выбранной карьерной траектории.</p>
      </div>
    </section>
  );
}
