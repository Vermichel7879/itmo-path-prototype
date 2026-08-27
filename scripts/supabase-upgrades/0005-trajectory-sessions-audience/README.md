# Trajectory sessions and audience upgrade 0005

Эти SQL-файлы — fallback для однократного ручного применения migration 0005 через Supabase SQL Editor. Они не создают пользовательские сессии и не меняют содержание вопросов, модулей, рекомендаций или существующие результаты. Backfill только помечает существующую конфигурацию как `MASTER`.

Порядок:

1. Запустить `01-schema-audience.sql` один раз. Ожидается `session_tables = 6`, `published_effective_master_snapshots >= 1`. Existing PUBLISHED snapshots не изменяются: отсутствующие audience-поля интерпретируются runtime и RPC как `MASTER=true`, `BACHELOR=false`; явный backfill выполняется только для DRAFT.
2. Запустить `02-session-progress-rpc.sql` один раз. Ожидается `progress_rpc_functions = 3`.
3. Запустить `03-session-completion-rpc.sql` один раз. Ожидается `completion_rpc_exists = true`.
4. Запустить `04-security-grants.sql` один раз. Ожидается `service_role_rpc_grants = 4`, остальные grants = 0.
5. Только после успешных шагов 1–4 запустить `05-drizzle-history.sql` один раз. Ожидается `drizzle_migration_records = 6`.
6. Последним запустить `verify.sql`.

Ожидается: `session_tables = 6`, `session_rpc_functions = 4`, `DRAFT = 1`, `PUBLISHED >= 1`, `drizzle_migration_records = 6`, `migration_0005_registered = true`, `draft_question_audience_backfilled = true`, `published_effective_master = true`.

Если chunk упал, не запускать его повторно и не переходить к следующему. Не запускать обычный Drizzle migrator поверх вручную применённых chunks.
