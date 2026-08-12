import type { ProgramDatabase } from "../types/program";
import type { JourneyAnswers, ProgramJourney } from "../types/journey";
import { selectedOption } from "../game/journeyEngine";

export function JourneyResult({ program, journey, answers }: { program: ProgramDatabase; journey: ProgramJourney; answers: JourneyAnswers }) {
  const career = program.careers.find((item) => item.career_id === answers.career_context);
  const chosen = journey.steps.flatMap((step) => {
    const option = selectedOption(step, answers);
    return option ? [{ step, option }] : [];
  });
  const profile = chosen.find(({ step }) => step.step_id === "profile_choice")?.option;
  const academic = chosen.filter(({ step }) => step.type === "interest_choice" && step.step_id !== "profile_choice");
  const problem = chosen.find(({ step }) => step.type === "career_center_situation")?.option;
  const disciplineById = new Map(program.disciplines.map((discipline) => [discipline.discipline_id, discipline]));
  const skillById = new Map(program.skills.map((skill) => [skill.skill_id, skill]));
  const disciplines = [...new Set(academic.flatMap(({ option }) => option.discipline_refs ?? []))].map((id) => disciplineById.get(id)).filter(Boolean);
  const skills = [...new Set(chosen.flatMap(({ option }) => option.skill_refs ?? []))].map((id) => skillById.get(id)).filter(Boolean);

  return (
    <section className="screen result-screen">
      <p className="eyebrow">Персональный результат</p>
      <h1>{journey.steps.find((step) => step.type === "result")?.title}</h1>
      <section className="result-section"><h2>Карьерная цель</h2><h3>{career?.title}</h3><p>{career?.short_description}</p></section>
      {profile ? <section className="result-section"><h2>Выбранный профиль</h2><h3>{profile.title}</h3><p>{profile.learning_benefit}</p></section> : null}
      <section className="result-section"><h2>Твои учебные интересы</h2>{academic.map(({ step, option }) => <p key={step.step_id}><strong>{option.title}.</strong> {option.learning_benefit}</p>)}</section>
      <section className="result-section"><h2>Связанные дисциплины</h2><ul>{disciplines.map((discipline) => <li key={discipline!.discipline_id}>{discipline!.name}</li>)}</ul></section>
      <section className="result-section"><h2>Ключевые навыки</h2><ul>{skills.map((skill) => <li key={skill!.skill_id}><strong>{skill!.title}:</strong> {skill!.description}</li>)}</ul></section>
      <section className="result-section"><h2>Практика и проекты</h2><p>На программе предусмотрены учебные и производственные практики, семинары и проектные форматы. Конкретная задача зависит от профиля, доступных проектов и правил программы.</p></section>
      <section className="result-section"><h2>Как ЦКО помогает во время обучения</h2><p>Карьерные консультации, помощь с резюме, подготовка к собеседованиям, поиск практик, стажировок, вакансий и карьерных мероприятий.</p></section>
      {problem ? <section className="result-section"><h2>Решение выбранной проблемы</h2><h3>{problem.title}</h3><p>{problem.outcome}</p>{career && problem.outcome_by_career?.[career.career_id] ? <p>{problem.outcome_by_career[career.career_id]}</p> : null}</section> : null}
      <section className="result-section"><h2>Рекомендации</h2>{chosen.filter(({ option }) => career && option.recommended_for_career_refs?.includes(career.career_id)).map(({ step, option }) => <p key={step.step_id}><strong>{option.title}:</strong> {option.recommendation_reason}</p>)}</section>
      <section className="result-section"><h2>Контакты ЦКО</h2><div className="contact-list">{journey.career_center_contacts.map((contact) => <a key={contact.contact_id} href={contact.url} target={contact.type === "email" ? undefined : "_blank"} rel="noreferrer">{contact.title}: {contact.value}</a>)}</div></section>
      <p className="disclaimer">{journey.result_config.framing}</p>
    </section>
  );
}
