-- Typed engine rules and deterministic module ordering. Run once.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.engine_rules') IS NULL THEN
    RAISE EXCEPTION 'Run typed-rules schema upgrade first';
  END IF;
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 3 THEN
    RAISE EXCEPTION 'Expected three Drizzle migration records';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM config_versions WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT')
     OR (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') <> 0 THEN
    RAISE EXCEPTION 'Unexpected config version state';
  END IF;
  IF EXISTS (SELECT 1 FROM engine_rules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Engine rules already exist for DRAFT';
  END IF;
  IF (SELECT count(*) FROM modules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 11
     OR EXISTS (SELECT 1 FROM modules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND sort_order IS NOT NULL) THEN
    RAISE EXCEPTION 'Expected 11 modules with empty sort_order';
  END IF;
END;
$$;

INSERT INTO engine_rules (
  id, config_version_id, stable_id, rule_kind, params, source_title,
  source_content, sort_order, active
) VALUES
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R01', 'WEIGHTED_SCORING'::engine_rule_kind, '{"aggregation":"SUM","mappingSource":"ANSWER_MODULE_WEIGHTS","selectedAnswersOnly":true}'::jsonb, 'Скоринг', 'Каждый выбранный ответ со значением в «Маппинг/вес» добавляет вес связанным модулям по таблице «02_Маппинг».', 1, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R02', 'TIE_BREAK'::engine_rule_kind, '{"questionIds":["Q2"],"questionScoreAggregation":"SUM_WEIGHTS","finalComparator":null}'::jsonb, 'Главный сигнал', 'Ответы Q2 (сложности) важнее остальных при равном итоговом балле.', 2, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R03', 'TIE_BREAK'::engine_rule_kind, '{"questionIds":["Q3","Q1","Q5"],"questionScoreAggregation":"SUM_WEIGHTS","finalComparator":"MODULE_SORT_ORDER_ASC"}'::jsonb, 'Второй приоритет', 'При равенстве после Q2 приоритет получает модуль, поддержанный Q3 (цель), затем Q1 (этап), затем Q5 (формат).', 3, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R04', 'RESULT_COMPOSITION'::engine_rule_kind, '{"primaryCount":1,"maxSupportCount":2,"sections":[{"stableId":"TITLE","title":"Заголовок","template":"Ваша карьерная траектория: {primary_module_name}","guidance":"Название меняется по основному модулю.","sortOrder":1},{"stableId":"CURRENT_POINT","title":"Точка А","template":"Сейчас ваш главный фокус — {primary_goal}.","guidance":"1–2 предложения на основе этапа + главной сложности.","sortOrder":2},{"stableId":"PRIORITIES","title":"Ваши ориентиры","template":"Для вас сейчас особенно важны: {priority_1}; {priority_2}; {priority_3}.","guidance":"Блок из Q6.","sortOrder":3},{"stableId":"PRIMARY_STEPS","title":"Три шага","template":"{primary_step_1}; {primary_step_2}; {primary_step_3}","guidance":"Берутся из основного модуля с учётом модификаторов. Для M11 — из листа 09.","sortOrder":4},{"stableId":"SUPPORT_MODULES","title":"Что добавить","template":"{support_module_1}; {support_module_2}","guidance":"Короткие блоки по 1–2 действия.","sortOrder":5},{"stableId":"RECOMMENDATIONS","title":"Что использовать в ИТМО","template":"{recommendation_1}; {recommendation_2}; {recommendation_3}","guidance":"Карточки из каталога рекомендаций.","sortOrder":6},{"stableId":"PACE","title":"Ваш темп","template":"{pace_text}","guidance":"Формируется по Q7: лёгкий / обычный / активный / интенсивный.","sortOrder":7},{"stableId":"CHECKPOINT","title":"Контрольная точка","template":"Через 2–4 недели у вас должно быть: {success_marker}.","guidance":"Маркер результата основного модуля.","sortOrder":8},{"stableId":"DISCLAIMER","title":"Дисклеймер","template":"Это стартовая траектория, а не карьерная диагностика. Её стоит уточнять после первых действий.","guidance":"Один короткий абзац.","sortOrder":9}]}'::jsonb, 'Количество модулей', 'В PDF выводить 1 основной модуль + максимум 2 поддерживающих.', 4, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R05', 'SUPPORT_SELECTION'::engine_rule_kind, '{"supportThreshold":4,"belowThresholdPolicy":"EXCLUDE","noEligibleSupportPolicy":"PRIMARY_ONLY","ranking":"MODULE_RANKING"}'::jsonb, 'Минимум веса', 'Поддерживающий модуль выводить только при суммарном весе ≥4. Если таких нет, оставить 1–2 модуля.', 5, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R06', 'MODIFIER_APPLICATION'::engine_rule_kind, '{"nonScoringQuestionIds":["Q4","Q6","Q7","Q8","Q9","Q10"],"executionOrder":["BASE_MODULE","BASE_MODIFIERS","M11_STAGE","M11_CHALLENGES","PRIORITIES","PACE"],"conflictPolicy":"ERROR_ON_UNRESOLVED_SAME_TARGET","m11StageOverridesModifierIds":["MOD07","MOD08"]}'::jsonb, 'Модификаторы', 'Q4, Q6, Q7, Q8, Q9 и Q10 в основном меняют текст, темп и рекомендации, а не основную ветку.', 6, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R07', 'RECOMMENDATION_SELECTION'::engine_rule_kind, '{"maxRecommendations":3,"modulePrecedence":["PRIMARY","SUPPORT_1","SUPPORT_2"],"withinModuleOrder":"PRIORITY_ASC","diversityMode":"SOFT","diversityCategories":[{"key":"CKO_SERVICE","recommendationTypes":["CKO_SERVICE"],"requiresConcreteOpportunity":false},{"key":"ECOSYSTEM","recommendationTypes":["EVENT","CLUB","FACULTY"],"requiresConcreteOpportunity":true},{"key":"GENERAL","recommendationTypes":["GENERAL"],"requiresConcreteOpportunity":false}],"fillRemainingWithNextEligible":true,"allowFewerThanMaximum":true,"slotWithoutOpportunityPolicy":"EXCLUDE"}'::jsonb, 'Рекомендации', 'Выбирать до 3 карточек: релевантный сервис ЦКО, слот экосистемы ИТМО и общая рекомендация. Если для модуля нет релевантного сервиса ЦКО, не добавлять его искусственно.', 7, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R08', 'RECOMMENDATION_PREFERENCE'::engine_rule_kind, '{"questionId":"Q8","selectionOrderPolicy":"IGNORE_CLICK_ORDER","multiplePreferencePolicy":"EQUAL_UNION","preferredBucketOrder":"NORMAL_CANDIDATE_ORDER","answerPreferences":{"Q8_A1":{"recommendationIds":["CKO_DIGEST"],"recommendationTypes":["GENERAL"],"defaultMix":false},"Q8_A2":{"recommendationIds":["CKO_CONSULT"],"recommendationTypes":[],"defaultMix":false},"Q8_A3":{"recommendationIds":[],"recommendationTypes":["EVENT"],"defaultMix":false},"Q8_A4":{"recommendationIds":["CKO_PRACTICE"],"recommendationTypes":["CLUB","FACULTY"],"defaultMix":false},"Q8_A5":{"recommendationIds":[],"recommendationTypes":[],"defaultMix":true}}}'::jsonb, 'Формат поддержки', 'Q8 меняет порядок карточек по предпочтению пользователя, но не карьерные приоритеты.', 8, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R09', 'PRIORITY_CAPTURE'::engine_rule_kind, '{"questionId":"Q6","resultField":"priorities","valueSource":"ANSWER_TEXT","minItems":1,"maxItems":3,"allowedKeys":["priority_tasks","priority_growth","priority_income","priority_flex","priority_stability","priority_team","priority_autonomy"],"recommendationTagField":"priorityTags","recommendationMatching":"SOFT_PREFERRED_FIRST","untaggedCandidatePolicy":"KEEP_ELIGIBLE"}'::jsonb, 'Ориентиры', 'Q6 вывести в PDF как 1–3 коротких ориентира и использовать как дополнительный фильтр при выборе рекомендаций.', 9, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R10', 'PACE_MAPPING'::engine_rule_kind, '{"questionId":"Q7","values":[{"answerId":"Q7_A1","key":"pace_light","actionsPerWeekMin":1,"actionsPerWeekMax":1,"parallelExperimentAllowed":false,"text":"Лёгкий темп: 1 небольшой шаг в неделю."},{"answerId":"Q7_A2","key":"pace_normal","actionsPerWeekMin":2,"actionsPerWeekMax":3,"parallelExperimentAllowed":false,"text":"Обычный темп: 2–3 действия в неделю."},{"answerId":"Q7_A3","key":"pace_active","actionsPerWeekMin":3,"actionsPerWeekMax":4,"parallelExperimentAllowed":false,"text":"Активный темп: 3–4 действия в неделю."},{"answerId":"Q7_A4","key":"pace_intensive","actionsPerWeekMin":null,"actionsPerWeekMax":null,"parallelExperimentAllowed":true,"text":"Интенсивный темп: можно вести параллельный эксперимент."}],"preservesCoreStepCount":3,"addAutomaticCoreStep":false}'::jsonb, 'Темп', 'Q7 меняет объём действий: light — 1 небольшой шаг/нед.; normal — 2–3; active — 3–4; intensive — можно добавлять параллельный эксперимент.', 10, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R11', 'RECOMMENDATION_DEDUPLICATION'::engine_rule_kind, '{"scope":"RESULT","keys":["RECOMMENDATION_ID","OPPORTUNITY_ID"],"keep":"FIRST_BY_CANDIDATE_ORDER"}'::jsonb, 'Дедупликация', 'Одинаковая рекомендация не должна повторяться в разных модулях одного PDF.', 11, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R12', 'CONTENT_POLICY'::engine_rule_kind, '{"triggerAnswerIds":["Q2_A8"],"targetModuleId":"M05","modifierIds":["MOD06"],"prohibitedClaims":["ATS_BYPASS"],"requiredFraming":["RELEVANCE","READABILITY","ADAPTATION","CONVERSION"]}'::jsonb, 'ATS', 'Не обещать «обход» автоматических фильтров. Формулировать как повышение релевантности и читаемости отклика + контроль конверсии.', 12, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R13', 'MODULE_GUARD'::engine_rule_kind, '{"moduleId":"M09","allowPrimaryWhen":{"kind":"ANY_ANSWER_ID","answerIds":["Q1_A5","Q2_A13","Q3_A10"]},"blockedPolicy":"REMOVE_FROM_PRIMARY_CANDIDATES"}'::jsonb, 'Офферы', 'M09 не выводить как основной без явного сигнала Q1_A5, Q2_A13 или Q3_A10.', 13, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R14', 'MODULE_GUARD'::engine_rule_kind, '{"moduleId":"M11","allowPrimaryWhen":{"kind":"ANY_ANSWER_TAG","tags":["entrepreneur_signal"]},"blockedPolicy":"REMOVE_FROM_PRIMARY_CANDIDATES"}'::jsonb, 'Предпринимательство', 'M11 не выводить как основной без entrepreneur_signal: Q1_A7, Q2_A14/Q2_A15, Q3_A12, Q4_A6/Q4_A7 или Q5_A4.', 14, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R15', 'CONDITIONAL_BRANCH'::engine_rule_kind, '{"condition":{"kind":"ANSWER_TAG_SELECTED","tag":"entrepreneur_signal"},"questionIds":["Q9","Q10"],"activePolicy":"SHOW_AND_VALIDATE","inactivePolicy":"HIDE_AND_IGNORE_ANSWERS"}'::jsonb, 'Условная ветка', 'Если entrepreneur_signal = true, показать Q9 и Q10. Иначе эти вопросы не показывать.', 15, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R16', 'ENTREPRENEUR_COMPOSITION'::engine_rule_kind, '{"moduleId":"M11","stageQuestionId":"Q9","challengeQuestionId":"Q10","stageSource":"ENTREPRENEUR_STAGES","stageReplaces":["GOAL","STEP_1","STEP_2","STEP_3","CHECKPOINT"],"challengeSource":"ENTREPRENEUR_CHALLENGES","challengeOutputField":"entrepreneurAdjustments","maxChallenges":2,"challengeOrder":"ANSWER_SORT_ORDER_ASC","challengeRecommendationSignal":true,"coreStepCount":3}'::jsonb, 'Предпринимательская подветка', 'Для M11 базовые шаги из «03_Модули» заменяются/уточняются контентом из «09_Предпринимательство» по Q9 и Q10.', 16, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'R17', 'FALLBACK_SELECTION'::engine_rule_kind, '{"activation":{"kind":"NO_ELIGIBLE_MODULE_AT_OR_ABOVE_THRESHOLD","thresholdRuleId":"R05"},"conditions":[{"kind":"ANY_ANSWER_TAG","tags":["entrepreneur_signal"],"moduleId":"M11"},{"kind":"ANY_ANSWER_ID","answerIds":["Q1_A1"],"moduleId":"M01"},{"kind":"ANY_ANSWER_ID","answerIds":["Q1_A2","Q1_A3","Q1_A4","Q1_A5"],"moduleId":"M02"},{"kind":"ANY_ANSWER_ID","answerIds":["Q1_A6"],"moduleId":"M10"}],"resultPrimaryCount":1}'::jsonb, 'Фолбэк', 'Если ни один модуль не набрал 4 балла: M01 для не начавших поиск, M02 для ищущих, M10 для уже работающих; при entrepreneur_signal — M11.', 17, TRUE);

UPDATE modules AS target
SET sort_order = source.sort_order
FROM (VALUES
    ('M01', 1),
    ('M02', 2),
    ('M03', 3),
    ('M04', 4),
    ('M05', 5),
    ('M06', 6),
    ('M07', 7),
    ('M08', 8),
    ('M09', 9),
    ('M10', 10),
    ('M11', 11)
) AS source(stable_id, sort_order)
WHERE target.config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid
  AND target.stable_id = source.stable_id;

DO $$
BEGIN
  IF (SELECT count(*) FROM engine_rules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 17
     OR (SELECT count(DISTINCT stable_id) FROM engine_rules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 17
     OR (SELECT count(*) FROM modules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND sort_order IS NOT NULL) <> 11 THEN
    RAISE EXCEPTION 'Typed engine rule seed validation failed';
  END IF;
END;
$$;

COMMIT;

SELECT
  (SELECT count(*) FROM engine_rules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) AS engine_rules,
  (SELECT count(*) FROM modules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND sort_order IS NOT NULL) AS modules_with_sort_order;
