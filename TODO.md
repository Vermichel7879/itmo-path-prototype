# План реализации

Работа выполняется строго по фазам. Переход к следующей фазе — только после явного разрешения владельца проекта.

## PHASE 0 — основа проекта

- [x] Проверить `git status`, текущую ветку, `HEAD` и remote.
- [x] Зафиксировать незакоммиченный каталог `source/` и не менять его.
- [x] Создать локальную резервную ветку `legacy-universe-prototype` от старого `HEAD`.
- [x] Остаться на основной ветке `main`.
- [x] Удалить старый Vite/React-код после создания резервной ветки.
- [x] Сохранить `.git`, существующий remote и файл `.gitignore`.
- [x] Создать чистый Next.js App Router scaffold с TypeScript, Tailwind и ESLint.
- [x] Зафиксировать целевую архитектуру в `ARCHITECTURE.md`.
- [x] Зафиксировать поэтапный план в `TODO.md`.
- [x] Выполнить lint, typecheck, tests и production build.
- [x] Повторно проверить Git и SHA-256 файлов `source/`.

## PHASE 1 — публичный UI на mock config

- [ ] Разобрать визуальные и контентные требования исходников без изменения `source/`.
- [ ] Ввести типизированный mock config вне UI-компонентов.
- [ ] Реализовать standalone header ИТМО / Центр карьеры.
- [ ] Реализовать 8 основных вопросов, single/multi и optional Q4/Q8.
- [ ] Реализовать progress, ручную кнопку «Продолжить» и возврат без потери ответов.
- [ ] Реализовать max-select без перестановки карточек.
- [ ] После Q5 динамически включать два предпринимательских вопроса.
- [ ] Реализовать mock result и responsive layouts.
- [ ] Проверить keyboard navigation, focus, semantics и контраст.
- [ ] Добавить UI-тесты для branching, max-select и навигации.
- [ ] Пройти quality gates.
- [ ] STOP и запросить разрешение на PHASE 2.

## PHASE 2 — PostgreSQL и импорт

- [ ] Выбрать server-only PostgreSQL layer и зафиксировать решение в архитектуре.
- [ ] Создать Supabase/PostgreSQL migrations для всех сущностей и ограничений.
- [ ] Реализовать draft и immutable published snapshots.
- [ ] Описать Zod schemas для DB boundaries и import model.
- [ ] Создать read-only importer текущего xlsx в draft.
- [ ] Добавить dry-run/diff: added, changed, removed.
- [ ] Добавить seed без runtime-зависимости от Excel.
- [ ] Добавить tests на schema, importer и draft/published separation.
- [ ] Пройти quality gates.
- [ ] STOP и запросить разрешение на PHASE 3.

## PHASE 3 — rule engine и реальные данные

- [ ] Реализовать чистый typed rule engine отдельно от UI.
- [ ] Реализовать weights, tie-break Q2 → Q3 → Q1 → Q5 и thresholds.
- [ ] Реализовать ограничения M09/M11 и fallback.
- [ ] Реализовать modifiers Q4/Q6/Q7/Q8 и Q9/Q10 для M11.
- [ ] Исключить дубли рекомендаций и внутренние scores из public result.
- [ ] Подключить published questionnaire и реальный result page.
- [ ] Превратить Excel-примеры E01–E07 в regression fixtures/tests.
- [ ] Пройти quality gates.
- [ ] STOP и запросить разрешение на PHASE 4.

## PHASE 4 — admin panel

- [ ] Реализовать `/admin/login`, bcrypt и server-side sessions.
- [ ] Реализовать роли ADMIN/EDITOR и server-side authorization.
- [ ] Реализовать users CRUD без показа старых паролей.
- [ ] Реализовать CRUD анкеты, модулей, логики, рекомендаций и возможностей.
- [ ] Реализовать condition builder и logic editor без ручного JSON/кода.
- [ ] Реализовать draft preview и admin-only debug trace.
- [ ] Реализовать publish, versions, restore-to-draft и republish.
- [ ] Реализовать audit log критических изменений.
- [ ] Добавить auth, permissions, versioning и preview tests.
- [ ] Пройти quality gates.
- [ ] STOP и запросить разрешение на PHASE 5.

## PHASE 5 — PDF, рекомендации и polish

- [ ] Выбрать PDF renderer и зафиксировать безопасный transport результата.
- [ ] Генерировать PDF из того же `TrajectoryResult`, что и result page.
- [ ] Реализовать максимум три релевантные рекомендации разных типов.
- [ ] Подключить opportunities с active/validity filtering.
- [ ] Провести responsive, accessibility и content polish.
- [ ] Добавить integration tests результата и PDF.
- [ ] Пройти quality gates.
- [ ] STOP и запросить разрешение на PHASE 6.

## PHASE 6 — production readiness

- [ ] Провести security review публичных и admin boundaries.
- [ ] Проверить отсутствие secrets, PII и service credentials в client bundle/Git.
- [ ] Проверить migrations, backup/rollback и deployment order.
- [ ] Провести финальные regression, accessibility и production build checks.
- [ ] Проверить совместимость с существующим Vercel project без создания нового.
- [ ] Дополнить README инструкцией deployment и environment variables.
- [ ] STOP и передать итоговый отчёт.
