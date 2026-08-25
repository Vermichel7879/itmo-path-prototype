# Архитектура «Карьерной траектории»

## 1. Статус документа

Документ обновлён по итогам PHASE 3. PUBLISHED repository, safe questionnaire DTO, server validation, rule engine R01–R17 и публичный UI работают на одной versioned конфигурации. Admin UI, auth и PDF остаются границами следующих фаз.

## 2. Назначение и ограничения

Система проводит короткую анонимную анкету и на основе детерминированных правил формирует `TrajectoryResult`: текущую точку, основной и до двух дополнительных карьерных фокусов, три действия, ориентиры, темп, до трёх рекомендаций и контрольную точку.

Система не является психологическим тестом, карьерной диагностикой или AI-рекомендателем. Внутренние баллы не показываются публичному пользователю. По умолчанию не собираются ФИО, ISU и email.

Исходные материалы в `source/` используются только для анализа и последующего seed/import. Excel не будет runtime-базой. Файлы `source/` считаются read-only и не меняются кодом приложения.

## 3. Технологический стек

- Next.js 16, App Router и React Server Components по умолчанию;
- React 19 и TypeScript strict;
- Tailwind CSS 4;
- PostgreSQL в Supabase как managed database;
- Drizzle ORM 0.45 как типизированная schema/query layer;
- `postgres.js` как server-only PostgreSQL driver с `prepare: false` для совместимости с Supabase transaction pooler;
- Zod для проверки всех входных данных на серверной границе;
- серверные sessions для admin panel;
- отдельный серверный PDF renderer, получающий готовый `TrajectoryResult`.

Drizzle выбран вместо client-side Supabase SDK: схема, запросы и migrations остаются PostgreSQL-совместимыми, прозрачными и не переносят бизнес-логику в браузер. Библиотека хеширования паролей и PDF-библиотека будут выбраны в соответствующих фазах.

## 4. Архитектурные принципы

1. **Сервер владеет данными.** Подключение к PostgreSQL, service-role credentials и административные операции существуют только в server-only модулях.
2. **Rule engine не зависит от UI и БД.** Он получает опубликованный snapshot конфигурации и список `answer_id`, возвращая строго типизированный `TrajectoryResult`.
3. **Один результат для экрана и PDF.** PDF renderer принимает тот же объект `TrajectoryResult`; отдельная логика расчёта для PDF запрещена.
4. **Публичная версия неизменяема.** Сайт читает только последний опубликованный immutable snapshot. Редактор работает только с draft.
5. **Стабильные ID отделены от текста.** Изменение формулировки не меняет `Q1`, `Q1_A1`, `M01` и другие технические идентификаторы.
6. **Входным данным клиента нельзя доверять.** Ответы повторно валидируются по активной опубликованной конфигурации.
7. **Простая структура важнее преждевременных абстракций.** Новые слои добавляются, когда появляется соответствующая фаза.

## 5. Целевая структура кода

```text
src/
  app/
    (public)/             # анкета и результат
    admin/                # login и защищённая admin panel
    api/                  # route handlers только там, где server actions недостаточно
  components/
    ui/                   # общие доступные UI-примитивы
  features/
    questionnaire/        # UX анкеты и локальное состояние прохождения
    trajectory/           # типы, rule engine, selectors и result presentation
    recommendations/      # подбор и представление рекомендаций
    admin/                 # формы и use cases административной части
  lib/
    auth/                  # server-side sessions и роли
    config/                # draft/published snapshots и validation
    db/                    # server-only connection, queries, transactions
    pdf/                   # renderer из TrajectoryResult
    validation/            # общие Zod schemas
  lib/db/config/
    __fixtures__/          # точные test-only сценарии T01–T31
scripts/
  import-career-config.*   # read-only чтение source/xlsx и импорт только в draft
supabase/
  migrations/              # версионируемая SQL-схема
source/                    # исходные материалы, read-only
```

Папки создаются по мере реализации; PHASE 0 не добавляет пустые архитектурные слои.

## 6. Потоки данных

### Публичная анкета

1. Сервер загружает последний published snapshot.
2. Клиент отображает только разрешённые вопросы и хранит выбор стабильных `answer_id`.
3. Сервер валидирует обязательность, single/multi, min/max и условия показа.
4. Rule engine рассчитывает `TrajectoryResult` по snapshot и ответам.
5. UI отображает результат без внутренних scores.
6. PDF renderer получает этот же результат через безопасную серверную границу.

### Редактирование и публикация

1. Авторизованный ADMIN/EDITOR меняет draft через проверенные server actions.
2. Zod проверяет payload, права и целостность ссылок; изменения пишутся в audit log.
3. Preview использует draft, но не меняет published config.
4. Publish внутри транзакции валидирует всю конфигурацию, создаёт immutable snapshot и делает новую версию опубликованной.
5. Rollback копирует выбранный snapshot в новый draft; повторная публикация создаёт новую версию, а не меняет историю.

### Импорт Excel

Importer читает обязательные листы XLSX напрямую как OOXML ZIP/XML, преобразует их в Zod-валидированную промежуточную модель, проверяет стабильные ID и ссылки и показывает diff. `db:import:dry` не импортирует database client и работает без `DATABASE_URL`; режим записи заменяет только единственный draft внутри транзакции. Повторный импорт никогда не перезаписывает published snapshot.

Checked-in `career-config-v2.json` содержит тот же валидированный snapshot и позволяет выполнить seed без runtime-доступа к `source/`. Первоначальный DRAFT загружен dependency-ordered SQL chunks из `scripts/supabase-seed/`; каждый chunk атомарен и защищён от случайного повторного запуска. Файл Excel остаётся read-only и не попадает в Git.

## 7. Модель данных

Основные нормализованные сущности: `questions`, `answers`, `answer_module_weights`, `modules`, `modifiers`, `recommendations`, `module_recommendations`, `opportunities`, `entrepreneur_stages`, `entrepreneur_challenges`, `config_versions`, `admin_users`, `admin_sessions`, `audit_log`.

`config_versions` хранит статус, номер версии, автора, source SHA-256, время публикации и полный JSONB snapshot бизнес-конфигурации. Все версионируемые сущности имеют `config_version_id`. Draft-таблицы удобны для CRUD; публичный код читает только snapshot последней PUBLISHED-версии.

Переход DRAFT → PUBLISHED будет выполняться транзакцией PHASE 4. После перехода PostgreSQL trigger запрещает update/delete строки опубликованной версии, а CHECK запрещает публиковать пустой snapshot. Редактирование draft поэтому не влияет на уже опубликованный результат.

В live Supabase реализованы 16 project tables: исходные 14 таблиц PHASE 2 и versioned `engine_rules`/`documentation_examples` из migration 0002. Также заполнены `modules.sort_order`, `recommendations.priority_tags` и типизированные modifier operation columns. Drizzle history содержит три migration records.

`engine_rules` хранит `rule_kind`, проверяемые Zod `params`, исходные title/content и порядок. Только kind/params исполняемы; исходный текст нужен для аудита. E01–E07 хранятся в `documentation_examples` и не исполняются. Канонический snapshot builder собирает полную конфигурацию из нормализованного DRAFT и не допускает publish при неполных или невалидных typed rules.

```text
normalized DRAFT tables
        ↓
canonical snapshot builder + Zod validation
        ↓
typed immutable PUBLISHED snapshot
        ↓
server-side rule engine
```

Текущий live state содержит один typed DRAFT и один immutable PUBLISHED. Initial publish завершён через SQL Editor и повторно не выполняется.

Transaction pooler стабильно выполняет scalar JSON-проверки, но закрывает соединение при возврате полного JSONB snapshot. Поэтому PUBLISHED repository работает fail-closed: проверяет в БД status, version, counts, R01–R17 и source SHA-256 snapshot, затем сопоставляет их с versioned production artifact. Artifact не является fallback: при отсутствии PUBLISHED или несовпадении hash публичные endpoints недоступны. DRAFT и mock runtime никогда не читаются.

### PHASE 4 schema и admin runtime

Административный каталог `opportunities` должен быть частью конкретной версии конфигурации: иначе изменение записи через admin UI обходит DRAFT и нарушает изоляцию уже опубликованного результата. Migration `0003_workable_leopardon.sql` добавляет обязательный `config_version_id`, внешний ключ и version-scoped indexes. Та же migration добавляет `admin_login_attempts`, где для database-backed login throttle хранятся только HMAC-SHA-256 ключи username/IP, вычисленные с server-only secret, без исходных значений. Узкая read-only функция `read_published_config_snapshot_chunk` возвращает только PUBLISHED snapshot порциями до 4096 символов: новый publish сможет стать текущей public-конфигурацией без checked-in artifact и без копирования child rows, несмотря на ограничение Transaction pooler на крупный JSONB response.

Upgrade из `scripts/supabase-upgrades/0003-phase4-admin/` применён и read-only проверен. Drizzle history содержит четыре записи. Admin runtime использует versioned opportunities и database-backed login throttle; public repository получает только PUBLISHED snapshots через chunk reader.

### Read/write connections

`TRANSACTION_DATABASE_URL` остаётся стабильным read connection только для public runtime. Admin subsystem полностью отделён от долгоживущих postgres.js sockets: все admin reads и writes идут из server-only кода через `@supabase/supabase-js`, Supabase Data API и узкие domain RPC. Обязательные `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` загружаются fail-closed и никогда не используют `NEXT_PUBLIC_`.

Составные operations представлены одной RPC каждая. Успешный login атомарно записывает throttle attempt, session hash, `last_login_at` и audit. User mutation защищает последнего активного ADMIN и пишет audit. DRAFT mutation принимает проверенные TypeScript-слоем canonical snapshot, expected `updated_at` и SHA-256 snapshot hash, затем атомарно меняет normalized rows, snapshot и audit. Publish повторно проверяет revision/hash, создаёт новый immutable PUBLISHED и audit. Application-level automatic retry запрещён.

RPC объявлены `SECURITY DEFINER` только для необходимой атомарности, имеют фиксированный `search_path = ''`, полностью квалифицированные имена объектов и явную проверку параметров/actor. `EXECUTE` отозван у `PUBLIC`, `anon`, `authenticated` и выдан только `service_role`; прямые table privileges Data API ролей отозваны, на admin/business tables включён RLS. Migration `0004_admin-data-api.sql` и атомарные SQL Editor chunks подготовлены, но до их ручного применения и `verify.sql` PHASE 4 остаётся в состоянии `PHASE4_DATA_API_UPGRADE_REQUIRED`.

## 8. Rule engine

Доменный API планируется в форме чистой функции:

```ts
calculateTrajectory(config: PublishedConfig, answerIds: AnswerId[]): TrajectoryResult
```

Алгоритм будет исполнять только утверждённые R01–R17: суммировать веса, применять Q2 → Q3 → Q1 → Q5 → `module.sort_order ASC`, ограничения M09/M11, строгий support threshold 4, fallback, типизированные modifier operations Q4/Q6/Q7/Q8 и предпринимательские Q9/Q10. Выбор рекомендаций ограничен тремя позициями, использует soft diversity и детерминированную дедупликацию, не раскрывая scores.

В debug preview вычислительная трассировка возвращается отдельным admin-only типом и никогда не входит в публичный DTO.

## 9. Аутентификация и безопасность

- `/admin` всегда проверяет server-side session; без неё выполняется redirect на `/admin/login`.
- Пароли хранятся только как bcrypt hash; plaintext-пароли не сохраняются и не логируются.
- Session cookie: `httpOnly`, `secure` в production, явный `sameSite`, срок действия и ротация.
- ADMIN и EDITOR проверяются на сервере для каждой mutation, а не только скрытием UI.
- Секреты и `.env*` не попадают в Git, логи или client bundle.
- Публичная анкета работает анонимно; техническая аналитика не содержит идентификаторов студента.

## 10. Тестирование и quality gates

- unit: rule engine, tie-break, thresholds, fallback, modifiers, deduplication;
- questionnaire: branching после Q5, Q4/Q8 optional, max-select и обратный переход;
- configuration: Zod validation всех R01–R17, modifier operations и canonical snapshot assembly;
- regression: точные test-only сценарии T01–T31; E01–E07 остаются только документационными примерами без вымышленных answer IDs;
- data: draft/published separation, publish transaction и rollback;
- auth: login, logout, expiry, роли и защита mutations;
- integration: public calculation и PDF используют один `TrajectoryResult`;
- accessibility: клавиатура, focus, semantics, contrast и disabled states.

Для каждой фазы обязательны `npm run lint`, `npm run typecheck`, `npm test` и `npm run build`.

## 11. Развёртывание

Существующий Git remote и существующая Vercel-привязка сохраняются. Новый Vercel project не создаётся. Production получает Supabase connection string и secrets только через environment variables. Миграции выполняются отдельным контролируемым шагом до выкладки приложения.

Public runtime reads используют server-only `TRANSACTION_DATABASE_URL` и `postgres.js` с `prepare: false`. Admin runtime использует server-only `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` через Data API/RPC; для криптографии сессий и throttle используется `ADMIN_SECURITY_SECRET`. `ADMIN_DATABASE_URL` и временный write probe удалены. `DIRECT_DATABASE_URL` и `DATABASE_URL` относятся только к migration tooling. Реальные `.env*` игнорируются, а `.env.example` содержит только пустые placeholders.

## 12. Отложенные решения

- формат краткоживущей передачи готового результата в PDF endpoint без персональных данных;
- библиотека PDF и стратегия подключения Golos/ALS Gorizont при наличии разрешённых font files;
- необходимость хранения анонимных технических событий и срок их retention.

Эти решения принимаются непосредственно перед соответствующей фазой и фиксируются здесь.
