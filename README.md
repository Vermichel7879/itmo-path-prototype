# Карьерная траектория ИТМО

Новый проект Центра карьеры ИТМО: короткая rule-based анкета, которая формирует карьерный фокус, ближайшие действия, ориентиры, темп и рекомендации.

Текущий статус: завершена **PHASE 4**. В Supabase существуют один рабочий DRAFT и immutable PUBLISHED history; публичная анкета читает только последний PUBLISHED snapshot, а закрытая `/admin` предоставляет DRAFT editing, preview, validation, users, audit и publish workflow.

## Локальный запуск

Требуется актуальная LTS-версия Node.js и npm.

```bash
npm install
npm run dev
```

Приложение откроется на [http://localhost:3000](http://localhost:3000).

Основные маршруты:

- `/` — landing;
- `/questionnaire` — анкета Q1–Q8 и условные Q9–Q10;
- `/result` — реальный `TrajectoryResult`, рассчитанный сервером для версии анкеты.
- `/admin/login` — закрытый вход сотрудников;
- `/admin` — защищённая рабочая панель ADMIN/EDITOR.

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:import:dry
npm run db:seed:rules:generate
npx drizzle-kit check
```

## Database layer

Используются PostgreSQL, Drizzle ORM, `postgres.js` и Zod. Drizzle сохраняет схему в TypeScript и генерирует проверяемые SQL migrations; `postgres.js` подходит для обычного PostgreSQL/Supabase и запускается с отключёнными prepared statements, что совместимо с transaction pooler. Database client находится только в server-only слое.

Доступные команды:

```bash
npm run db:generate      # генерирует migration из schema, не подключаясь к БД
npm run db:import:dry    # читает и валидирует XLSX, ничего не записывает
npm run db:migrate       # migration-only: DIRECT_DATABASE_URL, затем DATABASE_URL
npm run db:import        # runtime connection: TRANSACTION_DATABASE_URL
npm run db:seed          # runtime connection: TRANSACTION_DATABASE_URL
npm run db:verify        # read-only проверка schema и DRAFT
```

Runtime использует только `TRANSACTION_DATABASE_URL`; client работает с `prepare: false`. `DIRECT_DATABASE_URL` и `DATABASE_URL` зарезервированы для migration tooling и runtime-приложением не читаются. Published-конфигурация импортом не перезаписывается.

## Supabase после PHASE 2

Первоначальные schema и DRAFT уже загружены. Повторно запускать migrations, bootstrap или seed chunks в этой базе нельзя.

1. Локальный и Vercel runtime получают Transaction pooler URI только через `TRANSACTION_DATABASE_URL`.
2. Direct/Session URI могут задаваться как `DIRECT_DATABASE_URL`/`DATABASE_URL` только для контролируемых migration workflows.
3. Одноразовые SQL Editor инструкции сохранены в `scripts/supabase-bootstrap/` и `scripts/supabase-seed/` для аудита и восстановления пустой базы.
4. PUBLISHED проверяется read-only командами `npm run db:verify-published` и `npm run test:db:published`; initial publish повторно запускать нельзя.

Upgrade PHASE 2.5 уже применён: файлы из `scripts/supabase-upgrades/0002-typed-rules/`, затем `scripts/supabase-seed-rules/` были выполнены вручную и проверены. Эти одноразовые chunks повторно запускать нельзя; они сохранены для аудита и восстановления новой пустой базы.

Upgrade PHASE 4 `0003_workable_leopardon.sql` также применён и зарегистрирован как четвёртая Drizzle migration. Chunks из `scripts/supabase-upgrades/0003-phase4-admin/` повторно запускать нельзя.

## Initial admin bootstrap

Первый ADMIN создаётся только явной локальной командой. Пароль не передаётся аргументом командной строки и не выводится:

```powershell
# задать только в текущем локальном shell, не в tracked-файлах
$env:INITIAL_ADMIN_LOGIN = "vermichel"
$env:INITIAL_ADMIN_PASSWORD = "<new secret of at least 14 characters>"
npm run admin:create-initial
```

Команда откажется работать, если в базе уже существует хотя бы один admin user. Для runtime также обязателен независимый `ADMIN_SECURITY_SECRET` длиной не менее 32 символов; он используется для HMAC throttle identifiers и не должен совпадать с паролем.

Шаблон переменных находится в `.env.example`. Все реальные `.env`, `.env.local` и `.env.production` игнорируются Git.

## Документы

- [ARCHITECTURE.md](./ARCHITECTURE.md) — принятые архитектурные границы и целевая структура.
- [TODO.md](./TODO.md) — поэтапный план реализации.
- [docs/BUSINESS_RULE_DECISIONS.md](./docs/BUSINESS_RULE_DECISIONS.md) — утверждённая исполняемая семантика R01–R17, modifier operations и границы E01–E07/T01–T31.
- `source/` — исходные бизнес-материалы. Каталог нельзя изменять или удалять без отдельного явного решения.

## Технологическая основа

- Next.js 16 с App Router;
- React 19;
- TypeScript в strict-режиме;
- Tailwind CSS 4;
- ESLint.
- PostgreSQL schema + Drizzle ORM;
- `postgres.js` server-only connection;
- Zod validation;
- read-only OOXML importer и immutable seed snapshot.

Admin UI/auth, последующие publish workflows, PDF и реальные opportunities остаются в следующих фазах.

## Public runtime PHASE 3

`GET /api/questionnaire` возвращает безопасный DTO без weights, modifiers и engine rules. `POST /api/trajectory` принимает `configVersionId` и плоский список stable answer IDs, повторно проверяет required/min/max/conditional вопросы на сервере и возвращает только `TrajectoryResult`.

Repository допускает только запись со статусом PUBLISHED. Из-за ограничения Transaction pooler на большие JSON payload он проверяет metadata скалярными SQL-условиями и загружает immutable snapshot через server-only `read_published_config_snapshot_chunk(...)`. Каждый собранный snapshot проходит typed Zod validation; fallback на DRAFT, mock или checked-in artifact отсутствует.
