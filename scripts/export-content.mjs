import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const programDirectory = path.join(root, "src", "data", "programs");
const outputDirectory = path.join(root, "docs", "content-export");

const year1Choices = [
  ["employer_event", "Посетить карьерное мероприятие или встречу с работодателем", "Поможет увидеть реальные роли и задать первые вопросы представителям индустрии.", ["career_events"]],
  ["small_project", "Попробовать небольшой учебный или личный проект", "Небольшая законченная работа поможет понять, какие задачи интересны на практике.", ["career_events"]],
  ["self_explore", "Пока самостоятельно изучить интересующее направление", "Можно следить за возможностями и постепенно уточнять профессиональные интересы.", ["career_center_telegram", "career_center_vk"]],
  ["focus_study", "Сначала сосредоточиться на учёбе", "Фундаментальные дисциплины дадут основу, а к карьерным шагам можно вернуться позже.", ["career_center_telegram"]],
];

const year3Choices = [
  ["company_project", "Проект с командой или компанией", "Попробовать задачи выбранной профессии в совместной работе.", ["career_events", "practice"]],
  ["internship", "Стажировка", "Познакомиться с рабочим процессом и ожиданиями к начинающему специалисту.", ["internships", "resume"]],
  ["research", "Исследовательская работа", "Проверить интерес к исследованию и разбору профессиональных задач.", ["career_consultation", "career_events"]],
  ["own_project", "Собственный проект", "Самостоятельно пройти путь от идеи до результата для портфолио.", ["career_events"]],
];

const year4Choices = [
  ["internship_experience", "Опыт стажировки", "Завершить обучение с опытом рабочего процесса.", ["internships"]],
  ["strong_portfolio", "Сильное портфолио", "Собрать понятные примеры выполненных работ.", ["resume"]],
  ["research_project", "Исследовательский проект", "Завершить содержательную исследовательскую работу.", ["career_consultation"]],
  ["job_offer", "Предложение о работе", "Подготовиться к поиску первой позиции и собеседованиям.", ["vacancies", "interview"]],
  ["clear_direction", "Лучшее понимание своего профессионального направления", "Уточнить дальнейший карьерный маршрут.", ["career_consultation"]],
];

const eventResourceMapping = {
  project_or_internship: { project: ["practice", "career_events"], internship: ["internships", "resume"] },
  specialist_or_generalist: {
    specialist: ["career_consultation", "career_center_telegram"],
    generalist: ["career_consultation", "career_center_telegram"],
  },
};

function choiceObjects(items) {
  return items.map(([id, title, description, resourceIds]) => ({ id, title, description, resourceIds }));
}

function indices(db) {
  return {
    disciplines: new Map(db.disciplines.map((item) => [item.discipline_id, item])),
    skills: new Map(db.skills.map((item) => [item.skill_id, item])),
    groups: new Map(db.elective_groups.map((item) => [item.group_id, item])),
    resources: new Map(db.career_center.resources.map((item) => [item.resource_id, item])),
  };
}

function descendantGroupIds(group, groupById) {
  return group.child_group_ids.flatMap((id) => {
    const child = groupById.get(id);
    return child ? [id, ...descendantGroupIds(child, groupById)] : [];
  });
}

function meaningfulElective(db, route, preferredSemesters = [3, 4]) {
  const groupById = new Map(db.elective_groups.map((item) => [item.group_id, item]));
  const recommended = new Set(route.recommended_electives.map((item) => item.group_id));
  return db.elective_groups
    .filter((group) => group.selection_mode !== "all")
    .filter((group) => (group.selection_mode === "choose_n_groups" ? group.child_group_ids.length : group.options.length) >= 2)
    .map((group) => {
      const descendants = descendantGroupIds(group, groupById);
      const directRecommendation = recommended.has(group.group_id);
      const containsRecommendation = descendants.some((id) => recommended.has(id));
      const preferred = group.semesters.some((semester) => preferredSemesters.includes(semester));
      const careerFit = Math.max(0, ...group.options.map((option) => option.career_fit[route.career_id] ?? 0));
      const distance = Math.min(...group.semesters.map((semester) => Math.min(...preferredSemesters.map((item) => Math.abs(item - semester)))));
      return {
        group,
        selection_score: (directRecommendation ? 100 : 0) + (containsRecommendation ? 30 : 0) + (preferred ? 50 : 0) + careerFit * 5 - distance,
        score_factors: { directRecommendation, containsRecommendation, preferredSemester: preferred, maximumDirectCareerFit: careerFit, semesterDistance: distance },
      };
    })
    .sort((a, b) => b.selection_score - a.selection_score || a.group.group_id.localeCompare(b.group.group_id))[0] ?? null;
}

function resolveResourceIds(ids, idx) {
  return ids.flatMap((id) => {
    const resource = idx.resources.get(id);
    return resource ? [{ resource_id: id, title: resource.title, direct_url: resource.direct_url }] : [];
  });
}

function exportGroup(group, db, route, idx, seen = new Set()) {
  if (seen.has(group.group_id)) return { group_id: group.group_id, circular_reference: true };
  const nextSeen = new Set(seen).add(group.group_id);
  const recommendationByDiscipline = new Map(route.recommended_electives.map((item) => [item.discipline_id, item]));
  return {
    group_id: group.group_id,
    name: group.name,
    semesters: group.semesters,
    selection_mode: group.selection_mode,
    required_count: group.required_count,
    required_credits: group.required_credits,
    instruction:
      group.selection_mode === "choose_n_groups" ? `Выбрать групп: ${group.required_count ?? 1}`
      : group.selection_mode === "choose_n_disciplines" ? `Выбрать дисциплин: ${group.required_count ?? 1}`
      : group.selection_mode === "choose_credits" ? `Набрать не менее ${group.required_credits ?? 0} з.е.`
      : "Все элементы блока добавляются автоматически",
    options: group.options.flatMap((option) => {
      const discipline = idx.disciplines.get(option.discipline_id);
      if (!discipline) return [];
      const recommendation = recommendationByDiscipline.get(option.discipline_id);
      return [{
        discipline_id: option.discipline_id,
        name: discipline.name,
        credits: discipline.credits,
        semesters: discipline.semesters,
        simple_description: option.simple_description || discipline.simple_description || null,
        skills: option.skills.flatMap((id) => idx.skills.has(id) ? [{ skill_id: id, title: idx.skills.get(id).title }] : []),
        career_fit: option.career_fit[route.career_id] ?? 0,
        career_fit_text: ["Без рекомендации", "Может быть полезно", "Хорошо связано с твоей траекторией", "Особенно полезно для твоей траектории"][option.career_fit[route.career_id] ?? 0] ?? "Без рекомендации",
        recommended_elective: recommendation ? { priority: recommendation.priority, reason: recommendation.reason } : null,
      }];
    }),
    child_groups: group.child_group_ids.flatMap((id) => {
      const child = idx.groups.get(id);
      return child ? [exportGroup(child, db, route, idx, nextSeen)] : [];
    }),
  };
}

function careerQuestion(db, idx) {
  return {
    step: "career",
    question: "Выбери карьерную траекторию",
    selection_rule: "Выбрать ровно одну карьерную траекторию",
    answers: db.careers.map((career) => {
      const route = db.career_routes.find((item) => item.career_id === career.career_id);
      return {
        career_id: career.career_id,
        title: career.title,
        short_description: career.short_description,
        first_three_key_skills: career.key_skills.slice(0, 3).flatMap((id) => idx.skills.has(id) ? [{ skill_id: id, title: idx.skills.get(id).title }] : []),
        details: {
          what_you_do: career.what_you_do,
          key_skills: career.key_skills.flatMap((id) => idx.skills.has(id) ? [{ skill_id: id, title: idx.skills.get(id).title }] : []),
          specializations: career.specializations,
          why_this_program: career.why_this_program,
          entry_level_examples: career.entry_level_examples,
          core_disciplines: (route?.core_disciplines ?? []).slice(0, 5).flatMap((id) => idx.disciplines.has(id) ? [{ discipline_id: id, name: idx.disciplines.get(id).name }] : []),
        },
      };
    }),
  };
}

function buildExport(db, sourceFile) {
  const idx = indices(db);
  const commonQuestion = (step, question, items) => ({
    step,
    question,
    selection_rule: "Выбрать ровно один вариант; правильных и неправильных ответов нет",
    answers: choiceObjects(items).map((choice) => ({ ...choice, resources: resolveResourceIds(choice.resourceIds, idx) })),
  });
  const careerPaths = db.careers.map((career) => {
    const route = db.career_routes.find((item) => item.career_id === career.career_id);
    const selected = meaningfulElective(db, route);
    return {
      career_id: career.career_id,
      career_title: career.title,
      elective_question: selected ? {
        step: "elective",
        screen_title: selected.group.semesters.some((semester) => [3, 4].includes(semester)) ? "Выбор второго курса" : "Ключевой учебный выбор",
        lead: "Рекомендация учитывает выбранную профессию, но не ограничивает выбор.",
        preferred_semesters: [3, 4],
        selected_by_current_frontend: {
          group_id: selected.group.group_id,
          selection_score: selected.selection_score,
          score_factors: selected.score_factors,
        },
        group: exportGroup(selected.group, db, route, idx),
      } : null,
    };
  });
  const events = db.game_events.slice(0, 2).map((event, index) => ({
    step: index === 0 ? "event1" : "event2",
    event_id: event.event_id,
    semester: event.semester,
    question: event.title,
    description: event.description,
    selection_rule: "Выбрать ровно один вариант; правильных и неправильных ответов нет",
    answers: event.options.map((option) => {
      const ids = eventResourceMapping[event.event_id]?.[option.id]
        ?? (index === 1 ? ["career_consultation", "career_center_telegram"] : []);
      return { id: option.id, title: option.title, effects: option.effects, resourceIds: ids, resources: resolveResourceIds(ids, idx) };
    }),
  }));
  return {
    export_version: "1.0",
    generated_from: { program_database: `src/data/programs/${sourceFile}`, frontend_choices: "src/data/prototypeChoices.ts", elective_algorithm: "src/game/electiveResolver.ts" },
    program: db.program,
    flow: [
      { step: "start", content: { title: "Собери свой путь в ИТМО", text: "Пройди четыре года обучения, выбери карьерную траекторию и посмотри, какие решения могут помочь тебе двигаться к ней.", action: "Начать" } },
      { step: "program", question: "Выбери образовательную программу", search_fields: ["program.program_name", "program.direction_name"], current_program_answer: { program_name: db.program.program_name, direction_code: db.program.direction_code, direction_name: db.program.direction_name } },
      careerQuestion(db, idx),
      { step: "route_intro", content: { title: "Твой маршрут", semesters: db.timeline.map((item) => ({ semester: item.semester, career_stage: item.career_stage })), text: ["Обязательные дисциплины уже входят в программу.", "По ходу обучения ты примешь несколько решений, которые могут быть особенно полезны для выбранной карьерной траектории."] } },
      commonQuestion("year1_action", "С чего ты хочешь начать знакомство с профессией?", year1Choices),
      { step: "elective", varies_by_career: true, career_paths: careerPaths },
      events[0] ?? null,
      commonQuestion("year3_experience", "Какой профессиональный опыт тебе сейчас интереснее?", year3Choices),
      events[1] ?? null,
      commonQuestion("year4_goal", "С каким результатом ты хотел бы закончить обучение?", year4Choices),
      { step: "result", generated_fields: ["program", "career", "skills", "four_years", "career_actions", "career_center_resources", "recommendations", "disclaimer", "route_number"], placeholders: ["Отправка маршрута на почту", "Печать маршрута"] },
    ].filter(Boolean),
  };
}

function renderGroup(group, level = 0) {
  const lines = [];
  const heading = "#".repeat(Math.min(6, 4 + level));
  lines.push(`${heading} ${group.name}`);
  lines.push(`- ID: \`${group.group_id}\``);
  lines.push(`- Семестры: ${group.semesters.join(", ")}`);
  lines.push(`- Режим: \`${group.selection_mode}\``);
  lines.push(`- Правило: ${group.instruction}`);
  if (group.options.length) {
    lines.push("- Варианты:");
    for (const option of group.options) {
      lines.push(`  - **${option.name}** (\`${option.discipline_id}\`, ${option.credits} з.е.)`);
      lines.push(`    - Описание: ${option.simple_description ?? "не заполнено"}`);
      lines.push(`    - Навыки: ${option.skills.map((skill) => skill.title).join(", ") || "не указаны"}`);
      lines.push(`    - Связь с карьерой: ${option.career_fit_text} (в данных: ${option.career_fit})`);
      if (option.recommended_elective) lines.push(`    - Рекомендация маршрута: ${option.recommended_elective.priority}; ${option.recommended_elective.reason}`);
    }
  }
  for (const child of group.child_groups) lines.push("", renderGroup(child, level + 1));
  return lines.join("\n");
}

function renderMarkdown(data) {
  const lines = [`# ${data.program.program_name}`, "", `Направление: ${data.program.direction_code} — ${data.program.direction_name}.`, ""];
  for (const step of data.flow) {
    if (step.step === "career") {
      lines.push("## Выбор карьерной траектории", "", `**Вопрос:** ${step.question}`, "", `**Правило:** ${step.selection_rule}`, "");
      for (const answer of step.answers) {
        lines.push(`### ${answer.title}`, "", answer.short_description, "", `- ID: \`${answer.career_id}\``, `- Первые три навыка: ${answer.first_three_key_skills.map((item) => item.title).join(", ")}`, `- Что делает специалист: ${answer.details.what_you_do.join("; ")}`, `- Специализации: ${answer.details.specializations.join(", ")}`, `- Почему программа: ${answer.details.why_this_program}`, `- Стартовые позиции: ${answer.details.entry_level_examples.join(", ")}`, `- Связанные дисциплины: ${answer.details.core_disciplines.map((item) => item.name).join(", ")}`, "");
      }
    } else if (step.step === "elective") {
      lines.push("## Реальный учебный выбор", "", "Блок вычисляется отдельно после выбора карьеры. Ниже показан фактический результат текущего алгоритма.", "");
      for (const path of step.career_paths) {
        lines.push(`### Для карьеры «${path.career_title}»`, "");
        if (!path.elective_question) { lines.push("Подходящий блок не найден.", ""); continue; }
        lines.push(`Экран: **${path.elective_question.screen_title}**. Выбран корневой блок \`${path.elective_question.selected_by_current_frontend.group_id}\` (служебный selection score: ${path.elective_question.selected_by_current_frontend.selection_score}).`, "", renderGroup(path.elective_question.group), "");
      }
    } else if (step.answers) {
      lines.push(`## ${step.question}`, "", `Шаг: \`${step.step}\`. ${step.description ?? ""}`, "", `**Правило:** ${step.selection_rule}`, "");
      for (const answer of step.answers) {
        lines.push(`- **${answer.title}** (\`${answer.id}\`)`);
        if (answer.description) lines.push(`  - ${answer.description}`);
        if (answer.effects) lines.push(`  - Последствия: ${answer.effects.join("; ")}`);
        lines.push(`  - Ресурсы ЦКО: ${answer.resources.map((item) => item.title).join(", ") || "нет"}`);
      }
      lines.push("");
    } else if (step.step === "program") {
      lines.push("## Выбор программы", "", `В списке отображается: **${step.current_program_answer.program_name}**, ${step.current_program_answer.direction_code}, ${step.current_program_answer.direction_name}.`, "");
    } else if (step.step === "start") {
      lines.push("## Старт", "", `**${step.content.title}**`, "", step.content.text, "");
    } else if (step.step === "route_intro") {
      lines.push("## Знакомство с маршрутом", "", step.content.text.join(" "), "", `Семестры: ${step.content.semesters.map((item) => `${item.semester} — ${item.career_stage}`).join("; ")}.`, "");
    } else if (step.step === "result") {
      lines.push("## Итог", "", `Frontend формирует: ${step.generated_fields.join(", ")}.`, "", `Заглушки: ${step.placeholders.join(", ")}.`, "");
    }
  }
  return lines.join("\n");
}

fs.mkdirSync(outputDirectory, { recursive: true });
const files = fs.readdirSync(programDirectory).filter((file) => file.endsWith(".json"));
const summary = [];
for (const file of files) {
  const db = JSON.parse(fs.readFileSync(path.join(programDirectory, file), "utf8"));
  const data = buildExport(db, file);
  const slug = path.basename(file, ".json");
  fs.writeFileSync(path.join(outputDirectory, `${slug}.questions-and-answers.json`), `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, `${slug}.questions-and-answers.md`), `${renderMarkdown(data)}\n`);
  summary.push({ slug, program: db.program.program_name, careers: db.careers.length, events: db.game_events.length });
}
console.log(JSON.stringify(summary, null, 2));
