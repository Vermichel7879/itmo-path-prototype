# Решения по типизированной конфигурации правил

Статус: PHASE 2.5 завершена. Product decisions зафиксированы в коде и typed DRAFT snapshot; SQL upgrade и rule seed применены вручную и read-only проверены в Supabase. PUBLISHED отсутствует, PHASE 3 не начата.

Исходный XLSX остаётся источником бизнес-текстов, весов и справочников. Исполняемая семантика хранится отдельно в типизированных `rule_kind + params`; `source_title` и `source_content` сохраняются для аудита и сами по себе не исполняются.

## Правила R01–R17

| ID | Тип | Исполняемое решение |
| --- | --- | --- |
| R01 | `WEIGHTED_SCORING` | Суммировать веса выбранных ответов из `answer_module_weights`. |
| R02 | `TIE_BREAK` | Первый tie-break: сумма весов ответов Q2. |
| R03 | `TIE_BREAK` | Затем Q3, Q1, Q5; финально `modules.sort_order ASC`. |
| R04 | `RESULT_COMPOSITION` | Один primary, не более двух support; девять секций результата в исходном порядке. |
| R05 | `SUPPORT_SELECTION` | Строгий порог `4`; ниже порога support исключаются; допустим результат только с primary. |
| R06 | `MODIFIER_APPLICATION` | Порядок: base → base modifiers → M11 stage → M11 challenges → priorities → pace; неразрешённый конфликт одного target является ошибкой. |
| R07 | `RECOMMENDATION_SELECTION` | Максимум 3, primary/support precedence, `priority ASC`, мягкое разнообразие, только конкретные opportunities для соответствующего слота, меньше трёх допустимо. |
| R08 | `RECOMMENDATION_PREFERENCE` | Q8: A1 digest/general, A2 consult, A3 event, A4 club/faculty/practice, A5 default mix; multi-select образует равноправный union. |
| R09 | `PRIORITY_CAPTURE` | Q6 заполняет `priorities`; `priorityTags` — мягкое предпочтение, untagged рекомендации сохраняют eligibility. |
| R10 | `PACE_MAPPING` | Лёгкий 1, обычный 2–3, активный 3–4 действия в неделю; интенсивный — диапазон `null`, параллельный эксперимент разрешён; три core steps сохраняются. |
| R11 | `RECOMMENDATION_DEDUPLICATION` | Дедупликация по recommendation/opportunity ID с сохранением первого кандидата. |
| R12 | `CONTENT_POLICY` | Запрещено обещание обхода ATS; допустимы только relevance/readability/adaptation/conversion. |
| R13 | `MODULE_GUARD` | M09 может быть primary только при сигналах Q1_A5, Q2_A13 или Q3_A10. |
| R14 | `MODULE_GUARD` | M11 может быть primary только при выбранном ответе с `entrepreneur_signal`. |
| R15 | `CONDITIONAL_BRANCH` | Q9/Q10 показываются и валидируются только при `entrepreneur_signal`; иначе скрыты, а ответы игнорируются. |
| R16 | `ENTREPRENEUR_COMPOSITION` | Q9 заменяет цель, три шага и checkpoint M11; Q10 добавляет до двух adjustments в порядке ответов и recommendation signals. |
| R17 | `FALLBACK_SELECTION` | При отсутствии eligible module выше порога: entrepreneur→M11, Q1_A1→M01, Q1_A2–A5→M02, Q1_A6→M10. |

## Modifier operations

| IDs | Operation | Параметры |
| --- | --- | --- |
| MOD01 | `REPLACE_STEP` | step 3 |
| MOD02 | `REPLACE_STEP` | step 1 |
| MOD03 | `REPLACE_STEP` | step 3 |
| MOD04 | `REPLACE_STEP` | step 2 |
| MOD05 | `REPLACE_STEP` | step 2 |
| MOD06 | `APPEND_ADJUSTMENT` | после primary steps |
| MOD07 | `REPLACE_STEP` | step 1, только без Q9 stage для M11 |
| MOD08 | `REPLACE_STEP` | step 2, только без Q9 stage для M11 |
| MOD09 | `SET_PRIORITIES` | selected Q6 text → `priorities` |
| MOD10 | `SET_PACE` | Q7 через R10 |
| MOD11 | `REPLACE_M11_STAGE` | Q9 заменяет базовые MOD07/MOD08 |
| MOD12 | `APPEND_M11_CHALLENGE` | Q10, максимум 2, порядок `answer.sort_order ASC` |

## Примеры и тесты

E01–E07 хранятся как versioned `documentation_examples`: это неисполняемые описания из исходника, не production fixtures и не источник выбранных answer IDs. Точные машинные сценарии T01–T31 находятся только в test fixture и покрывают scoring, всю цепочку tie-break, support threshold, guards, fallback, modifier operations, Q6/Q7/Q8, Q9/Q10, deduplication и ветвление.

## Публикация snapshot

Будущий publish workflow обязан собрать snapshot из нормализованных DRAFT-таблиц через канонический builder, полностью проверить его Zod-схемой и только затем сохранить immutable PUBLISHED snapshot. Public runtime и rule engine не должны исполнять свободный текст правила или повторно читать изменяемые DRAFT-таблицы.
