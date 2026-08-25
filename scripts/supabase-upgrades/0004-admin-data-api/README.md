# Admin Data API upgrade 0004

Эти файлы предназначены для однократного ручного запуска в Supabase SQL Editor. Они создают защищённые RPC-функции для admin runtime, включают RLS и регистрируют migration 0004. Они не меняют DRAFT/PUBLISHED snapshots, business data или существующих admin users.

Порядок запуска:

1. Откройте Supabase SQL Editor и создайте новый query.
2. Вставьте `01-admin-auth-rpc.sql`, нажмите **Run** один раз. Ожидается `auth_rpc_functions = 7`.
3. В новом query запустите `02-admin-users-rpc.sql` один раз. Ожидается `user_rpc_functions = 2`.
4. В новом query запустите `03-admin-content-rpc.sql` один раз. Ожидается `content_rpc_functions = 2`.
5. В новом query запустите `04-admin-publish-reads-rpc.sql` один раз. Ожидается `publish_read_rpc_functions = 5`.
6. В новом query запустите `05-security-grants.sql` один раз. Все шесть возвращённых privilege-полей должны быть `true`.
7. Только после успешных шагов 1–6 запустите `06-drizzle-history.sql` один раз. Ожидается `drizzle_migration_records = 5`.
8. Последним запустите `verify.sql`.

Ожидаемый результат `verify.sql`: `admin_rpc_functions = 16`, `service_role_rpc_grants = 16`, `anon_rpc_grants = 0`, `authenticated_rpc_grants = 0`, `rls_enabled_tables = 17`, `draft_configs = 1`, `published_configs = 1`, `admin_users = 1`, `drizzle_migration_records = 5`, `migration_0004_registered = true`.

Если любой chunk завершился ошибкой, не запускайте его повторно и не переходите к следующему. Пришлите точный текст ошибки для диагностики. Не запускайте обычный Drizzle migrator поверх вручную применённых chunks.
