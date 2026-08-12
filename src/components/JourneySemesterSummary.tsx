import type { ProgramDatabase } from "../types/program";
import type { JourneyStep } from "../types/journey";

export function JourneySemesterSummary({ program, step }: { program: ProgramDatabase; step: JourneyStep }) {
  const disciplineById = new Map(program.disciplines.map((discipline) => [discipline.discipline_id, discipline]));
  const disciplines = (step.discipline_refs ?? []).map((id) => disciplineById.get(id)).filter(Boolean);
  return (
    <section className="screen">
      <p className="eyebrow">{step.semester} семестр</p>
      <h1>{step.title}</h1>
      <div className="semester-facts">
        <article><h2>Что появляется</h2><p>{step.what_appears}</p></article>
        <article><h2>Что ты делаешь</h2><p>{step.what_student_does}</p></article>
        <article><h2>Чему учишься</h2><p>{step.what_student_learns}</p></article>
        <article><h2>Где пригодится</h2><p>{step.where_it_is_used}</p></article>
      </div>
      {disciplines.length ? <p className="discipline-line"><strong>Примеры реальных дисциплин:</strong> {disciplines.map((item) => item!.name).join(", ")}.</p> : null}
    </section>
  );
}
