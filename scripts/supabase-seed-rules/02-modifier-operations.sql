-- Typed modifier operations. Run once after 01-engine-rules.sql.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM modifiers WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 12 THEN
    RAISE EXCEPTION 'Expected 12 DRAFT modifiers';
  END IF;
  IF EXISTS (
    SELECT 1 FROM modifiers
    WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid
      AND (operation_kind IS NOT NULL OR operation_params IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Typed modifier operations already exist or seed is partial';
  END IF;
END;
$$;

UPDATE modifiers AS target
SET operation_kind = source.operation_kind,
    operation_params = source.operation_params
FROM (VALUES
    ('MOD01', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":3,"replacementText":"Проверьте выбранную роль на реальных вакансиях.","appliesWhen":"ALWAYS"}'::jsonb),
    ('MOD02', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":1,"replacementText":"Проведите аудит и адаптацию актуального резюме.","appliesWhen":"ALWAYS"}'::jsonb),
    ('MOD03', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":3,"replacementText":"Усильте и упакуйте существующие кейсы.","appliesWhen":"ALWAYS"}'::jsonb),
    ('MOD04', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":2,"replacementText":"Упакуйте текущий опыт и найдите следующий более сильный кейс.","appliesWhen":"ALWAYS"}'::jsonb),
    ('MOD05', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":2,"replacementText":"Расширьте каналы и проверьте качество текущего списка.","appliesWhen":"ALWAYS"}'::jsonb),
    ('MOD06', 'APPEND_ADJUSTMENT'::modifier_operation_kind, '{"text":"Добавить блок про первичный фильтр: простая структура, релевантные термины, адаптация под вакансию, контроль конверсии.","placement":"AFTER_PRIMARY_STEPS"}'::jsonb),
    ('MOD07', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":1,"replacementText":"Сформулируйте аудиторию и проблему, затем перейдите к проверке спроса.","appliesWhen":"NO_M11_STAGE"}'::jsonb),
    ('MOD08', 'REPLACE_STEP'::modifier_operation_kind, '{"stepNumber":2,"replacementText":"Соберите обратную связь пользователей и проверьте повторяемость спроса и бизнес-модель.","appliesWhen":"NO_M11_STAGE"}'::jsonb),
    ('MOD09', 'SET_PRIORITIES'::modifier_operation_kind, '{"questionId":"Q6","resultField":"priorities","valueSource":"SELECTED_ANSWER_TEXT"}'::jsonb),
    ('MOD10', 'SET_PACE'::modifier_operation_kind, '{"questionId":"Q7","ruleId":"R10"}'::jsonb),
    ('MOD11', 'REPLACE_M11_STAGE'::modifier_operation_kind, '{"questionId":"Q9","source":"ENTREPRENEUR_STAGES","replacesBaseModifierIds":["MOD07","MOD08"]}'::jsonb),
    ('MOD12', 'APPEND_M11_CHALLENGE'::modifier_operation_kind, '{"questionId":"Q10","source":"ENTREPRENEUR_CHALLENGES","outputField":"entrepreneurAdjustments","maxItems":2,"order":"ANSWER_SORT_ORDER_ASC"}'::jsonb)
) AS source(stable_id, operation_kind, operation_params)
WHERE target.config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid
  AND target.stable_id = source.stable_id;

DO $$
BEGIN
  IF (
    SELECT count(*) FROM modifiers
    WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid
      AND operation_kind IS NOT NULL AND operation_params IS NOT NULL
  ) <> 12 THEN
    RAISE EXCEPTION 'Typed modifier operation seed validation failed';
  END IF;
END;
$$;

COMMIT;

SELECT count(*) AS typed_modifier_operations
FROM modifiers
WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid
  AND operation_kind IS NOT NULL AND operation_params IS NOT NULL;
