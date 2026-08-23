# Карьерная траектория ИТМО

Новый проект Центра карьеры ИТМО: короткая rule-based анкета, которая формирует карьерный фокус, ближайшие действия, ориентиры, темп и рекомендации.

Текущий статус: завершена database foundation **PHASE 2**. Supabase schema применена, Drizzle history содержит две migration records, а валидированный XLSX snapshot загружен в единственный DRAFT. Frontend-сценарий PHASE 1 до начала PHASE 3 продолжает работать на mock-конфигурации.

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
- `/result` — демонстрационный результат из mock rule layer.

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:import:dry
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
4. Текущий DRAFT проверяется командой `npm run db:verify`; PUBLISHED и admin user в PHASE 2 не создаются.

Шаблон переменных находится в `.env.example`. Все реальные `.env`, `.env.local` и `.env.production` игнорируются Git.

## Документы

- [ARCHITECTURE.md](./ARCHITECTURE.md) — принятые архитектурные границы и целевая структура.
- [TODO.md](./TODO.md) — поэтапный план реализации.
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

Production rule engine, admin UI/auth, публикация draft, PDF и реальные opportunities остаются в следующих фазах.
