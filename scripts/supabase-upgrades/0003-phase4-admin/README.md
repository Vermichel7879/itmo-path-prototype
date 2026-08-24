# PHASE 4 schema upgrade

Эти SQL-файлы предназначены для однократного ручного запуска в Supabase SQL Editor. Они не создают администратора, не меняют DRAFT/PUBLISHED snapshots и не содержат credentials.

Порядок запуска:

1. Создать новый query, вставить `01-login-throttle.sql`, нажать **Run** один раз. Ожидается `admin_login_attempts_exists = true`, `login_attempt_records = 0`.
2. Только после успешного шага 1 создать новый query, вставить `02-version-opportunities.sql`, нажать **Run** один раз. Ожидается `opportunities_versioned = true`, `opportunities = 0`.
3. Только после успешного шага 2 создать новый query, вставить `03-published-snapshot-reader.sql`, нажать **Run** один раз. Ожидается `published_snapshot_reader_exists = true`.
4. Только после успешного шага 3 создать новый query, вставить `04-drizzle-history.sql`, нажать **Run** один раз. Ожидается `drizzle_migration_records = 4`.
5. Последним выполнить `verify.sql`.

Ожидаемый результат `verify.sql`:

- `admin_login_attempts_exists = true`;
- `admin_login_attempt_records = 0`;
- `opportunities = 0`;
- `opportunities_versioned = true`;
- `opportunities_version_fk_exists = true`;
- `opportunities_version_stable_index_exists = true`;
- `published_snapshot_reader_exists = true`;
- `draft_configs = 1`;
- `published_configs = 1`;
- `latest_published_id = 0699b9e9-790e-4909-b84c-946ee3d70233`;
- `drizzle_migration_records = 4`;
- `migration_0003_registered = true`.

Если любой chunk завершился ошибкой, не запускайте его повторно и не переходите к следующему. Пришлите точный текст ошибки для диагностики.
