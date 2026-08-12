# Текущая схема данных frontend

## 1. Runtime-источники

Frontend статически импортирует ровно три файла:

```text
src/data/programs/laser-technologies.json
src/data/programs/computer-technologies-design.json
src/data/programs/computer-technologies.json
```

Они собираются в массив в `src/data/programs/index.ts`. Идентификатор программы вычисляется как:

```typescript
database.program.program_name
```

Имя файла не используется как идентификатор программы. `analysis_audit*.json`, `expert_review*.md` и DOCX frontend не импортирует и в браузер не загружает.

Дополнительный runtime-источник — `src/data/prototypeChoices.ts`. В нём находятся вопросы и ответы, которых нет в program JSON:

- решение первого курса;
- выбор профессионального опыта третьего курса;
- цель четвёртого курса;
- mapping ответов на ресурсы Центра карьеры.

## 2. Корневая структура JSON программы

```typescript
interface ProgramDatabase {
  schema_version: string;
  program: ProgramInfo;
  source_summary: Record<string, unknown>;
  careers: Career[];
  skills: Skill[];
  disciplines: Discipline[];
  elective_groups: ElectiveGroup[];
  practices: Practice[];
  timeline: TimelineSemester[];
  career_actions: CareerAction[];
  career_center: {
    name: string;
    resources: CareerCenterResource[];
  };
  game_events: GameEvent[];
  career_routes: CareerRoute[];
  disclaimer: string;
}
```

Точный машиночитаемый контракт фактически потребляемых полей находится в `frontend-consumed.schema.json`.

## 3. Фактически используемые поля

### `program`

| Поле | Использование |
|---|---|
| `program_name` | ID программы, поиск, карточка и итоговый маршрут |
| `direction_code` | карточка программы |
| `direction_name` | поиск и карточка программы |

Остальные метаданные программы сохраняются в JSON и типизированы, но текущий UI их не отображает.

### `careers[]`

| Поле | Использование |
|---|---|
| `career_id` | связь с `career_routes`, `career_fit`, действиями и состоянием игры |
| `title` | карточка, персонализация и итог |
| `short_description` | карточка, детали и итог |
| `what_you_do` | подробности и персонализированные пояснения третьего курса |
| `key_skills` | ссылки на `skills[].skill_id` |
| `specializations` | подробности профессии |
| `why_this_program` | подробности профессии |
| `entry_level_examples` | подробности профессии |

### `skills[]`

`skill_id` создаёт индекс, `title` показывается пользователю. Остальные поля текущий UI не использует.

### `disciplines[]`

| Поле | Использование |
|---|---|
| `discipline_id` | разрешение ссылок из timeline, routes и elective options |
| `name` | все пользовательские названия дисциплин |
| `credits` | проверка `choose_credits` |
| `simple_description` | fallback-описание elective-дисциплины |

### `elective_groups[]`

Используются все структурные поля:

```text
group_id
name
semesters
selection_mode
required_count
required_credits
child_group_ids
options
```

`selection_mode` принимает:

```text
all
choose_n_disciplines
choose_n_groups
choose_credits
```

Каждый `options[]` использует:

```text
discipline_id
simple_description
skills[]
career_fit { [career_id]: 0 | 1 | 2 | 3 }
```

`parent_module_id` хранится и типизирован, но текущая рекурсия строится по `child_group_ids`.

### `timeline[]`

| Поле | Использование |
|---|---|
| `semester` | восьмисеместровая шкала и группировка по курсам |
| `mandatory_highlights` | обязательные дисциплины текущего года |
| `career_stage` | подсказка у блока семестра |

`elective_decisions`, `skills_focus` и `recommended_actions` находятся в базе, но текущий UI их напрямую не читает.

### `career_actions[]`

Используются `action_id`, `title`, `description`, `career_ids` и `career_center_resources`. Поля `recommended_semesters` и `reason` сейчас не выводятся.

### `career_center.resources[]`

Используются:

```text
resource_id
title
direct_url
```

Ссылка создаётся только при непустом `direct_url`. `type` сейчас не влияет на UI.

### `game_events[]`

Frontend берёт два первых элемента массива:

```typescript
program.game_events[0]
program.game_events[1]
```

Используются `event_id`, `title`, `description`, а в `options[]` — `id`, `title`, `effects`. `semester` содержится в модели, но текущая позиция экрана задаётся state machine.

### `career_routes[]`

Маршрут связывается с профессией по `career_id`. Используются:

```text
key_skills
core_disciplines
recommended_electives
timeline_highlights
career_actions
```

В `recommended_electives[]` используются `group_id`, `discipline_id`, `priority`, `reason`.

`summary` и `career_center_resources` присутствуют в базе, но текущий итоговый route builder их не читает.

### `disclaimer`

Строка выводится в итоговом маршруте без изменения.

## 4. Поля только для проверки или пока не используемые

В development mode проверяется наличие непустых массивов `careers`, `skills`, `disciplines`, `timeline`, `career_routes`, `game_events` и наличие route для каждой career.

Текущий frontend не читает содержимое:

```text
source_summary
practices
```

Они всё равно остаются частью полного TypeScript-типа `ProgramDatabase`, поскольку могут понадобиться следующей версии.

## 5. Индексы frontend

После выбора программы frontend один раз строит:

```typescript
disciplineById
skillById
careerById
groupById
actionById
resourceById
routeByCareerId
```

Все пользовательские названия получаются через эти индексы. Сырые `DISC_*`, `GRP_*`, `career_id` и `skill_id` в обычном UI не показываются.

## 6. Состояние прохождения

Состояние не находится в program JSON. Оно хранится в React и дублируется в `localStorage` под ключом `itmo-path-prototype-state`:

```typescript
interface GameState {
  schemaVersion: 1;
  selectedProgramId: string | null;
  selectedCareerId: string | null;
  year1Action: string | null;
  electiveSelection: {
    groupId: string;
    selectedGroupIds: string[];
    selectedDisciplineIds: string[];
  } | null;
  eventChoices: Record<string, string>;
  year3Experience: string | null;
  year4Goal: string | null;
  addedCareerActions: string[];
  selectedCareerCenterResources: string[];
  resourceSelections: Record<string, string[]>;
  currentStep: GameStep;
  routeNumber: string;
}
```

## 7. Важное текущее поведение elective

`selectMeaningfulElectiveGroup(program, careerRoute, [3, 4])` оценивает все реальные пользовательские группы. Текущая формула учитывает:

```text
+100 — сама группа упомянута в recommended_electives
+30  — рекомендованная группа находится среди потомков
+50  — группа относится к 3 или 4 семестру
+5 × maximum direct career_fit
− расстояние до 3/4 семестра
```

При равенстве выбирается меньший `group_id` по строковой сортировке.

Фактический результат текущих данных:

| Программа | Корневой блок для всех career этой программы |
|---|---|
| Компьютерные технологии в дизайне | `GRP_120` — «Выбор траектории по 3D КТвД 26» |
| Компьютерные технологии | `GRP_10` — «Модуль специализации» |
| Лазерные технологии | `GRP_26` — «Математика (3 семестр)» |

Career всё равно влияет на подписи `career_fit` и `recommended_electives` внутри вариантов. Однако на текущих данных выбранный корневой блок внутри каждой программы одинаков для всех профессий. Это описание фактического поведения, а не проектное требование.
