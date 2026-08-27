# Admin module recommendation management upgrade 0007

Эти SQL-файлы предназначены для однократного ручного применения migration 0007 через Supabase SQL Editor. Они добавляют только атомарный ADMIN RPC для CREATE / UPDATE / DELETE связи Module → Recommendation. Business data, DRAFT и PUBLISHED при установке не изменяются.

Порядок:

1. Запустить `01-module-recommendation-rpc.sql` один раз. Ожидается: `module_recommendation_rpc_exists = true`, `service_role_execute = true`, `anon_execute = false`, `authenticated_execute = false`.
2. Только после успешного шага 1 запустить `02-drizzle-history.sql` один раз. Ожидается: `drizzle_migration_records = 8`.
3. Последним запустить `verify.sql`.

Ожидаемый итог: RPC существует, execute доступен только `service_role`, `draft_configs = 1`, `published_configs >= 1`, `drizzle_migration_records = 8`, `migration_0007_registered = true`.

Если chunk упал, не запускать его повторно и не переходить к следующему. Сначала прислать полный текст ошибки и результат read-only `verify.sql`. Не запускать обычный Drizzle migrator поверх вручную применённых chunks.
