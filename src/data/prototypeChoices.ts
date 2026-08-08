export interface PrototypeChoice {
  id: string;
  title: string;
  description: string;
  resourceIds: string[];
}

export const year1Choices: PrototypeChoice[] = [
  {
    id: "employer_event",
    title: "Посетить карьерное мероприятие или встречу с работодателем",
    description: "Поможет увидеть реальные роли и задать первые вопросы представителям индустрии.",
    resourceIds: ["career_events"],
  },
  {
    id: "small_project",
    title: "Попробовать небольшой учебный или личный проект",
    description: "Небольшая законченная работа поможет понять, какие задачи интересны на практике.",
    resourceIds: ["career_events"],
  },
  {
    id: "self_explore",
    title: "Пока самостоятельно изучить интересующее направление",
    description: "Можно следить за возможностями и постепенно уточнять профессиональные интересы.",
    resourceIds: ["career_center_telegram", "career_center_vk"],
  },
  {
    id: "focus_study",
    title: "Сначала сосредоточиться на учёбе",
    description: "Фундаментальные дисциплины дадут основу, а к карьерным шагам можно вернуться позже.",
    resourceIds: ["career_center_telegram"],
  },
];

export const year3Choices: PrototypeChoice[] = [
  {
    id: "company_project",
    title: "Проект с командой или компанией",
    description: "Попробовать задачи выбранной профессии в совместной работе.",
    resourceIds: ["career_events", "practice"],
  },
  {
    id: "internship",
    title: "Стажировка",
    description: "Познакомиться с рабочим процессом и ожиданиями к начинающему специалисту.",
    resourceIds: ["internships", "resume"],
  },
  {
    id: "research",
    title: "Исследовательская работа",
    description: "Проверить интерес к исследованию и разбору профессиональных задач.",
    resourceIds: ["career_consultation", "career_events"],
  },
  {
    id: "own_project",
    title: "Собственный проект",
    description: "Самостоятельно пройти путь от идеи до результата для портфолио.",
    resourceIds: ["career_events"],
  },
];

export const year4Choices: PrototypeChoice[] = [
  { id: "internship_experience", title: "Опыт стажировки", description: "Завершить обучение с опытом рабочего процесса.", resourceIds: ["internships"] },
  { id: "strong_portfolio", title: "Сильное портфолио", description: "Собрать понятные примеры выполненных работ.", resourceIds: ["resume"] },
  { id: "research_project", title: "Исследовательский проект", description: "Завершить содержательную исследовательскую работу.", resourceIds: ["career_consultation"] },
  { id: "job_offer", title: "Предложение о работе", description: "Подготовиться к поиску первой позиции и собеседованиям.", resourceIds: ["vacancies", "interview"] },
  { id: "clear_direction", title: "Лучшее понимание своего профессионального направления", description: "Уточнить дальнейший карьерный маршрут.", resourceIds: ["career_consultation"] },
];

export const eventResourceMapping: Record<string, Record<string, string[]>> = {
  project_or_internship: {
    project: ["practice", "career_events"],
    internship: ["internships", "resume"],
  },
  specialist_or_generalist: {
    specialist: ["career_consultation", "career_center_telegram"],
    generalist: ["career_consultation", "career_center_telegram"],
  },
};

export function findChoice(choices: PrototypeChoice[], id: string | null): PrototypeChoice | undefined {
  return choices.find((choice) => choice.id === id);
}
