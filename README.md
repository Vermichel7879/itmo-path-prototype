# «Собери свой путь в ИТМО» — интерактивный прототип

Одностраничная сайт-игра для проверки сценария: программа → профессия → четыре года решений → два события → персональный маршрут. Это технический прототип без backend, аккаунтов, email, печати и AI API.

## Запуск

```powershell
cd site-prototype
npm install
npm run dev
```

Проверка production-сборки и тестов:

```powershell
npm run build
npm test
```

## Подключённые программы

- Лазерные технологии
- Компьютерные технологии в дизайне
- Компьютерные технологии

Runtime использует только копии `site_program_database.json` из `src/data/programs/`. Audit и expert review в браузер не загружаются.

## Структура

- `src/data/programs/` — три JSON и единый индекс программ;
- `src/data/prototypeChoices.ts` — только продуктовые выборы прототипа и mapping ресурсов ЦКО;
- `src/game/` — reducer/state machine, индексы, elective resolver, сохранение и сборка маршрута;
- `src/components/` — универсальные карточки, timeline, elective/event/result;
- `src/screens/` — экраны последовательного flow;
- `src/test/` — unit-тесты и полный smoke flow для каждой программы.

## Как добавить четвёртую программу

1. Положить новый `site_program_database.json` под понятным именем в `src/data/programs/`.
2. Импортировать его в `src/data/programs/index.ts` и добавить в массив `databases`.
3. Запустить `npm test` и `npm run build`.

Идентификатор и отображаемое название берутся из `database.program.program_name`, поэтому остальной UI и игровая логика не требуют нового screen или условий по названию программы.

## Debug и сохранение

Откройте `http://localhost:5173/?debug=1`, чтобы увидеть внизу текущие программу, профессию, шаг, семестр, elective, события и ресурсы. Состояние сохраняется в `localStorage` под ключом `itmo-path-prototype-state`; кнопка «Начать заново» очищает сессию.

## Что является заглушкой

Email и печать показаны на финальном экране только как disabled-блоки. В прототипе нет формы email, PDF, QR, SMTP, print API, сервера, БД или очереди печати. Номер маршрута генерируется только локально для проверки будущей механики.
