# Карьерная траектория ИТМО

Новый проект Центра карьеры ИТМО: короткая rule-based анкета, которая формирует карьерный фокус, ближайшие действия, ориентиры, темп и рекомендации.

Текущий статус: завершена database foundation **PHASE 2**. Frontend-сценарий PHASE 1 продолжает работать на mock-конфигурации, а PostgreSQL schema, migrations, server-only Drizzle layer и read-only Excel importer уже подготовлены. Внешняя база пока не подключена и migrations никуда не применялись.

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
npm run db:migrate       # требует DATABASE_URL и применяет migrations
npm run db:import        # требует DATABASE_URL и заменяет только DRAFT
npm run db:seed          # требует DATABASE_URL, использует checked-in JSON snapshot
```

`db:migrate`, `db:import` и `db:seed` нельзя запускать без созданного Supabase и осознанно заданного `DATABASE_URL`. Published-конфигурация импортом не перезаписывается.

## Как подключить Supabase после PHASE 2

Сейчас выполнять эти шаги не требуется. Когда будет принято решение подключить базу:

1. Создать новый project в Supabase Dashboard и сохранить database password в менеджере паролей.
2. В проекте нажать **Connect**. Для локальных migrations выбрать Direct connection, если доступен IPv6, либо Session pooler для IPv4-сети.
3. Скопировать URI и поместить его только в локальный `.env.local` как `DATABASE_URL=...`. Файл не коммитить.
4. Запустить `npm run db:migrate`. Команда сама применит подготовленные migrations; вручную писать SQL не нужно.
5. Запустить `npm run db:import` для создания DRAFT из XLSX либо `npm run db:seed` для загрузки checked-in snapshot без доступа к `/source`.
6. Проверить draft до публикации. Механизм публикации появится в PHASE 4; текущий importer не создаёт PUBLISHED сам.
7. Для будущего Vercel runtime использовать Transaction pooler URI в переменной `DATABASE_URL`; application client уже отключает prepared statements.

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
