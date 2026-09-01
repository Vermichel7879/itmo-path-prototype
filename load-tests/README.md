# Public trajectory load baseline

Сценарий `public-trajectory.mjs` запускается только вручную через k6. Он создаёт MASTER-сессию, получает закреплённую за ней анкету, строит валидный набор ответов из фактического DTO, сохраняет каждый видимый вопрос и получает результат.

## Безопасность

- Не запускайте профили `target` и `spike` против Production.
- 300/500 VU разрешены только для согласованного test/staging окружения.
- Используйте отдельный цифровой `TEST_ISU_PREFIX`, зарезервированный только для синтетических данных. Скрипт дополняет его идентификаторами запуска, VU и итерации и никогда не печатает итоговый ИСУ.
- Скрипт не использует service keys, cookies или реальные ИСУ и не подключён к build/deploy/CI.

## Запуск

Нужен установленный `k6`. По умолчанию `BASE_URL=http://127.0.0.1:3000`, но URL лучше всегда указывать явно.

```powershell
k6 run -e PROFILE=smoke -e BASE_URL=http://127.0.0.1:3000 -e TEST_ISU_PREFIX=990000000 load-tests/public-trajectory.mjs
```

Remote smoke для Amvera (замените placeholder на домен своего приложения):

```powershell
k6 run -e PROFILE=smoke -e 'BASE_URL=https://<amvera-domain>' -e TEST_ISU_PREFIX=990000000 load-tests/public-trajectory.mjs
```

Нагрузочный тест разрешено запускать только против собственного согласованного
test/staging-окружения. Профили `target` и `spike` нельзя запускать против Production.

Профили нагрузки:

```powershell
# До 50 одновременных VU
k6 run -e PROFILE=normal -e BASE_URL=https://staging.example -e TEST_ISU_PREFIX=990000000 load-tests/public-trajectory.mjs

# До 300 VU — только разрешённый test/staging
k6 run -e PROFILE=target -e CONFIRM_HIGH_LOAD=yes -e BASE_URL=https://staging.example -e TEST_ISU_PREFIX=990000000 load-tests/public-trajectory.mjs

# Быстрый выход на 500 VU — только разрешённый test/staging
k6 run -e PROFILE=spike -e CONFIRM_HIGH_LOAD=yes -e BASE_URL=https://staging.example -e TEST_ISU_PREFIX=990000000 load-tests/public-trajectory.mjs
```

Любое промежуточное число VU задаётся без копирования сценария. Например, 100 VU:

```powershell
k6 run -e PROFILE=normal -e VUS=100 -e BASE_URL=https://staging.example -e TEST_ISU_PREFIX=990000000 load-tests/public-trajectory.mjs
```

Так же можно передать `VUS=150`, `VUS=200` или `VUS=250`. Длительности регулируются через `RAMP_DURATION`, `HOLD_DURATION` и `RAMP_DOWN_DURATION`; значения по умолчанию — `30s`, `2m`, `30s`. При `VUS>=300` по-прежнему обязателен `CONFIRM_HIGH_LOAD=yes`.

Между действиями используется случайная пауза 1–3 секунды. `smoke` выполняет ровно один проход для каждого из 5 VU; остальные профили измеряют устойчивую конкурентную нагрузку и могут выполнить несколько проходов на VU.

## Метрики

k6 выводит `http_reqs` (включая requests/sec), `http_req_failed`, а также p50 (`med`), p95 и p99. Дополнительно собираются:

- `session_start_duration`;
- `questionnaire_duration`;
- `answer_save_duration`;
- `answer_save_requests_per_flow` (ожидаемо 3 для 8 вопросов и 4 для 10);
- `trajectory_result_duration`;
- `flow_error_rate`.

Каждый public response также содержит `Server-Timing`. k6 автоматически собирает из него:

- `server_total_duration`;
- `server_session_read_duration` / `server_session_write_duration`;
- `server_data_api_duration`;
- `server_config_read_duration`;
- `server_rule_engine_duration`;
- `server_completion_write_duration`.
- `config_cache_hits` / `config_cache_misses` / `config_cache_coalesced`.
- `config_cache_load_success` / `config_cache_load_failure`;
- `data_api_failure_timeout` / `network` / `http` / `rpc` / `response` / `unknown`.
- `session_start_failure_400` / `401_403` / `409` / `422` / `429` / `5xx` / `network_timeout` / `other`;
- `session_start_failure_machine_error` с безопасным tag `error_code` из JSON API.

После любого раннего failure сценарий ждёт случайные 1–3 секунды перед завершением
iteration. Ошибочный write не повторяется, а VU не начинает следующую iteration мгновенно.

В браузере значения видны в Network → конкретный запрос → Response Headers → `Server-Timing`. В k6 у server metrics есть tag `endpoint` со значениями `SESSION_START`, `QUESTIONNAIRE`, `ANSWER_SAVE`, `TRAJECTORY_RESULT`.

Единственный baseline threshold: HTTP и flow error rate должны быть ниже 1%. Жёстких duration thresholds пока нет.

## Запросы одного пользователя

Обычный MASTER-проход без предпринимательской ветки содержит 6 HTTP-запросов:

- reads: 1 × `GET /api/questionnaire`;
- writes: 1 × start + 3 × batch answer save + 1 × completion = 5;
- config reads на HTTP-уровне: questionnaire получает pinned config текущей session; result использует тот же `configVersionId` в payload;
- session operations: 1 × `POST /api/trajectory-sessions`, 3 × `PUT /api/trajectory-sessions/answers`, 1 × `POST /api/trajectory`.

Если выбран `entrepreneurSignal`, добавляются Q9/Q10 и ещё один batch `PUT`: всего 7 HTTP-запросов. `PUT /api/trajectory-sessions/answers` вызывается 3 или 4 раза на проход.

При прогретом immutable config cache обычный проход вызывает 8 Data API/RPC операций:

- reads: 3 — latest PUBLISHED summary и два чтения session context;
- writes: 5 — start session, 3 full-set answer writes и completion;
- pinned questionnaire/engine config добавляют по одному read только при cache miss;
- session operations: 7 — start, два context read, 3 answer writes и completion.

Для предпринимательской ветки добавляется один full-set answer-write RPC: всего 9 Data API/RPC операций при cache HIT.
