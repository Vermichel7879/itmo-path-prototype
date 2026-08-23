# Карьерная траектория ИТМО

Новый проект Центра карьеры ИТМО: короткая rule-based анкета, которая формирует карьерный фокус, ближайшие действия, ориентиры, темп и рекомендации.

Текущий статус: завершена **PHASE 3**. В Supabase существуют один DRAFT и один immutable PUBLISHED; публичная анкета и результат работают через versioned PUBLISHED configuration, server-side validation и чистый typed rule engine R01–R17. Production runtime больше не использует mock-конфигурацию.

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

Repository допускает только запись со статусом PUBLISHED. Из-за ограничения Transaction pooler на большие JSON payload он проверяет структуру, counts, source SHA-256 и immutable PUBLISHED snapshot скалярными SQL-условиями, после чего разрешает только совпадающий versioned production artifact `src/lib/db/seed/career-config-v2.json`. Несовпадение версии или hash приводит к fail-closed состоянию; fallback на DRAFT или mock отсутствует.
