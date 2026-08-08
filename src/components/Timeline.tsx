import type { TimelineSemester } from "../types/program";

interface Props {
  timeline: TimelineSemester[];
  currentSemester?: number | null;
}

export function Timeline({ timeline, currentSemester }: Props) {
  return (
    <div className="timeline" aria-label="Восемь семестров обучения">
      {timeline.map((item) => (
        <div
          className={item.semester === currentSemester ? "semester current" : "semester"}
          key={item.semester}
          aria-current={item.semester === currentSemester ? "step" : undefined}
          title={item.career_stage}
        >
          <span>{item.semester}</span>
          <small>сем</small>
        </div>
      ))}
    </div>
  );
}
