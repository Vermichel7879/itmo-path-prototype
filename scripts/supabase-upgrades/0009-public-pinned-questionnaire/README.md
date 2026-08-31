# 0009 — pinned public questionnaire

В Supabase SQL Editor выполните `01-pinned-questionnaire-rpc.sql`, затем `verify.sql`.

Это `CREATE OR REPLACE FUNCTION`, поэтому файл безопасно заменяет уже созданную ошибочную версию RPC. Ожидаемый результат последнего `SELECT`:

`pinned_questionnaire_rpc_exists = true`, `pinned_engine_config_rpc_exists = true`,
`service_role_engine_rpc_grant = true`, `anon_engine_rpc_grant = false`.

Drizzle history пока не регистрируйте: для 0009 она будет добавлена только после успешного smoke-test RPC.
