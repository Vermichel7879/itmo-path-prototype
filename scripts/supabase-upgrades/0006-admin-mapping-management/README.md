# Admin mapping management upgrade 0006

Эти SQL-файлы — fallback для однократного ручного применения migration 0006 через Supabase SQL Editor. Они добавляют только атомарный ADMIN RPC для CREATE / UPDATE / DELETE Mapping. Business data, DRAFT и PUBLISHED при установке не изменяются.

Порядок:

1. Запустить `01-mapping-rpc.sql` один раз. Ожидается: `mapping_rpc_exists = true`, `service_role_execute = true`, `anon_execute = false`, `authenticated_execute = false`.
2. Только после успешного шага 1 запустить `02-drizzle-history.sql` один раз. Ожидается: `drizzle_migration_records = 7`.
3. Последним запустить `verify.sql`.

Ожидаемый итог: `mapping_rpc_exists = true`, execute только у `service_role`, `draft_configs = 1`, `published_configs >= 1`, `drizzle_migration_records = 7`, `migration_0006_registered = true`.

Если chunk упал, не запускать его повторно и не переходить к следующему. Сначала прислать полный текст ошибки и результат read-only `verify.sql`. Не запускать обычный Drizzle migrator поверх вручную применённых chunks.
