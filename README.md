# Карьерная траектория ИТМО

Новый проект Центра карьеры ИТМО: короткая rule-based анкета, которая формирует карьерный фокус, ближайшие действия, ориентиры, темп и рекомендации.

Текущий статус: UI **PHASE 4** реализован, но для его production write path требуется подготовленный upgrade 0004 на Supabase Data API. До ручного применения и проверки upgrade административный runtime считается fail-closed. В Supabase существуют один рабочий DRAFT и immutable PUBLISHED history; публичная анкета продолжает читать только последний PUBLISHED snapshot.

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

Используются PostgreSQL, Drizzle ORM, `postgres.js`, официальный `@supabase/supabase-js` и Zod. Drizzle сохраняет схему и migration history. Стабильный public read runtime остаётся на server-only `postgres.js` через Transaction pooler. Admin runtime использует server-only Supabase client и узкие Postgres RPC; service-role credential не передаётся в браузер.

Доступные команды:

```bash
npm run db:generate      # генерирует migration из schema, не подключаясь к БД
npm run db:import:dry    # читает и валидирует XLSX, ничего не записывает
npm run db:migrate       # migration-only: DIRECT_DATABASE_URL, затем DATABASE_URL
npm run db:import        # runtime connection: TRANSACTION_DATABASE_URL
npm run db:seed          # runtime connection: TRANSACTION_DATABASE_URL
npm run db:verify        # read-only проверка schema и DRAFT
```

Public runtime использует `TRANSACTION_DATABASE_URL`. Все admin reads и writes направляются через Supabase Data API (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) в domain RPC. Каждый составной write выполняется внутри одной Postgres RPC transaction, а повторный автоматический запуск после transport error запрещён. `ADMIN_DATABASE_URL` и временный write probe удалены; `DIRECT_DATABASE_URL` и `DATABASE_URL` зарезервированы только для migration tooling.

## Supabase после PHASE 2

Первоначальные schema и DRAFT уже загружены. Повторно запускать migrations, bootstrap или seed chunks в этой базе нельзя.

1. Локальный и Vercel public read runtime получают Transaction pooler URI только через `TRANSACTION_DATABASE_URL`.
2. Admin runtime требует server-only `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`; имена с префиксом `NEXT_PUBLIC_` запрещены.
3. Domain RPC upgrade 0004 применён вручную и проверен: 16 функций доступны только `service_role`, RLS включён на 17 таблицах, migration зарегистрирована. Chunks из `scripts/supabase-upgrades/0004-admin-data-api/` повторно запускать нельзя.
4. Direct migration URI задаётся как `DIRECT_DATABASE_URL`/`DATABASE_URL` только для контролируемых migration workflows.
5. Одноразовые bootstrap/seed SQL сохранены для аудита и восстановления пустой базы. PUBLISHED initial publish повторно запускать нельзя.

Upgrade PHASE 2.5 уже применён: файлы из `scripts/supabase-upgrades/0002-typed-rules/`, затем `scripts/supabase-seed-rules/` были выполнены вручную и проверены. Эти одноразовые chunks повторно запускать нельзя; они сохранены для аудита и восстановления новой пустой базы.

Upgrade PHASE 4 `0003_workable_leopardon.sql` применён и зарегистрирован как четвёртая Drizzle migration. Chunks из `scripts/supabase-upgrades/0003-phase4-admin/` повторно запускать нельзя. `0004_admin-data-api.sql` также применён и зарегистрирован как пятая migration; его SQL Editor chunks повторно запускать нельзя.

Первый ADMIN уже создан. Для admin runtime обязателен независимый `ADMIN_SECURITY_SECRET` длиной не менее 32 символов; он используется для HMAC throttle identifiers и не должен совпадать с паролем или service-role credential.

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
- `postgres.js` для public read runtime и Supabase Data API/Postgres RPC для admin runtime;
- Zod validation;
- read-only OOXML importer и immutable seed snapshot.

Admin Data API upgrade должен быть вручную применён и проверен до признания PHASE 4 production-ready. PDF остаётся следующей фазой.

## Public runtime PHASE 3

`GET /api/questionnaire` возвращает безопасный DTO без weights, modifiers и engine rules. `POST /api/trajectory` принимает `configVersionId` и плоский список stable answer IDs, повторно проверяет required/min/max/conditional вопросы на сервере и возвращает только `TrajectoryResult`.

Repository допускает только запись со статусом PUBLISHED. Из-за ограничения Transaction pooler на большие JSON payload он проверяет metadata скалярными SQL-условиями и загружает immutable snapshot через server-only `read_published_config_snapshot_chunk(...)`. Каждый собранный snapshot проходит typed Zod validation; fallback на DRAFT, mock или checked-in artifact отсутствует.
