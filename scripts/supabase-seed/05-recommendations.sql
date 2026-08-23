-- Supabase SQL Editor data seed chunk 05: recommendations
-- Generated only from src/lib/db/seed/career-config-v2.json.
-- DRAFT config UUID: a8ad8398-48dc-41d7-9793-5e21248be966
-- Run once, only after the preceding chunk returned expected counts.

BEGIN;

DO $seed_guard_05$
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
    OR NOT EXISTS (SELECT 1 FROM config_versions WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'Expected exactly the prepared DRAFT configuration';
  END IF;

  IF EXISTS (SELECT 1 FROM config_versions WHERE status = 'PUBLISHED') THEN
    RAISE EXCEPTION 'PUBLISHED configuration must not exist during seed bootstrap';
  END IF;

  IF EXISTS (SELECT 1 FROM "recommendations" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Recommendations for the DRAFT already exist';
  END IF;
END
$seed_guard_05$;

INSERT INTO "recommendations" (
  "id", "config_version_id", "stable_id", "type", "title", "description", "url", "status", "tags", "active"
) VALUES
  ('1911582e-a441-4d09-83b1-8e607a735444'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'CKO_CONSULT', 'CKO_SERVICE', 'Карьерная консультация', 'Подключать, когда нужен выбор направления, разбор ситуации, подготовка к собеседованию или выбор между вариантами.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('0361951b-66f3-48bf-816b-034a5bd21ddb'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'CKO_RESUME', 'CKO_SERVICE', '«Резюме от ИТМО»', 'Подключать к ветке резюме и откликов.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('e43927f1-b5f1-4568-a976-d1e9cfb5dceb'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'CKO_PRACTICE', 'CKO_SERVICE', 'База практик', 'Подключать к веткам первого опыта и практической подготовки.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('4e213155-776e-4d79-876a-8e8558f1b18b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'CKO_DIGEST', 'CKO_SERVICE', 'Рассылки, дайджесты и карьерные подборки', 'Подключать к поиску возможностей и поддержанию регулярного поиска.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('edef4c98-93d0-4c9a-984e-adae108413d3'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'CKO_INTERNSHIPS', 'CKO_SERVICE', 'Стажировки от партнёров университета', 'Подключать к поиску и первому опыту.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'EVENT', 'EVENT', 'Мероприятия', 'Категория-слот. Конкретные мероприятия подставлять из актуального каталога по теме/дате.', NULL, 'SLOT', '[]'::jsonb, TRUE),
  ('8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'CLUB', 'CLUB', 'Клубы', 'Категория-слот. Конкретные клубы можно привязать к профессиональному направлению или предпринимательскому интересу.', NULL, 'SLOT', '[]'::jsonb, TRUE),
  ('10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'FACULTY', 'FACULTY', 'Факультетские активности', 'Категория-слот. Конкретные активности подставлять по факультету/мегафакультету.', NULL, 'SLOT', '[]'::jsonb, TRUE),
  ('9db4739c-7ce6-469c-b0c4-3277d22e39bb'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_MARKET_SCAN', 'GENERAL', 'Сверка с рынком', 'Собрать 10–15 вакансий по роли и выписать повторяющиеся задачи и требования.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('54b66cf5-d442-49c8-892b-8125bf079a41'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_SEARCH_TRACKER', 'GENERAL', 'Трекер поиска', 'Вести вакансии, даты откликов и этапы в одной таблице; раз в неделю смотреть конверсию.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('3277da5f-bbd5-4310-906e-feadc194e368'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_EVIDENCE', 'GENERAL', 'Портфолио доказательств', 'Для каждого сильного навыка иметь пример: проект, кейс, репозиторий, презентацию или измеримый результат.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('83fa4b1e-7f37-45a7-b57c-9e87cb3b1dad'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_SKILL_GAP', 'GENERAL', 'Карта дефицита навыков', 'Разделить навыки на «есть», «нужно подтянуть», «чем подтвердить» и выбрать не больше двух приоритетов.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('fa89e155-3588-48a7-ba6e-907ed60102ce'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_RESUME_AUDIT', 'GENERAL', 'Аудит резюме под вакансию', 'Проверить релевантность, порядок блоков, конкретику достижений и соответствие требованиям роли.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('0c8850e3-10df-4645-9431-aa8fc718bdca'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_MOCK_INTERVIEW', 'GENERAL', 'Тренировочное собеседование', 'Провести пробное интервью и зафиксировать 3 ответа, которые нужно улучшить.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('09a6cf48-97d4-4331-af92-5d7c3a4c0722'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_TEST_FRAMEWORK', 'GENERAL', 'Шаблон тестового задания', 'Фиксировать задачу, допущения, ход решения, результат и короткое пояснение для проверяющего.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('e74116e4-8142-4f64-af45-3469e5384495'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_SEARCH_RHYTHM', 'GENERAL', 'Недельный ритм поиска', 'Задать фиксированные окна на поиск, отклики и подготовку; оценивать прогресс по воронке, а не по одному отказу.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('3c2226c6-f196-4850-879a-fa3620930ee1'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_OFFER_MATRIX', 'GENERAL', 'Матрица выбора', 'Сравнить варианты по задачам, команде, наставнику, развитию, формату и условиям.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('6a1eedba-68d7-4af4-a3ce-09d5ad06da36'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_SEMESTER_PLAN', 'GENERAL', 'План на семестр', 'Выбрать одну карьерную цель и один проект, который должен дать новый уровень ответственности или результата.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('adbac3f5-8e89-46b4-97dd-e203b9aebb74'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_ENT_CUSTOMER', 'GENERAL', 'Интервью с потенциальными пользователями', 'Поговорить с 5–10 людьми из предполагаемой аудитории о проблеме и текущем способе её решения; не продавать идею во время интервью.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('899f58ef-ff39-422f-ab8a-30f756a5f7e4'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_ENT_EXPERIMENT', 'GENERAL', 'Минимальный тест спроса', 'Проверить одну ключевую гипотезу самым дешёвым способом: прототип, форма интереса, пилот, предзаказ или другой измеримый тест.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('e0e741b8-dfb7-4180-ab35-807a9aadb825'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_ENT_MODEL', 'GENERAL', 'Черновик бизнес-модели', 'Зафиксировать: кто пользователь, кто платит, какую ценность получает, как приходит в продукт, основные затраты и ключевая метрика.', NULL, 'ACTIVE', '[]'::jsonb, TRUE),
  ('62aa944d-446f-4d4a-99b5-0ad321179d03'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'GEN_ENT_TEAM', 'GENERAL', 'Карта команды', 'Определить, какие компетенции критичны для следующего эксперимента и что можно закрыть самому, партнёром или точечной помощью.', NULL, 'ACTIVE', '[]'::jsonb, TRUE);

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '05' AS chunk,
  count(*)::integer AS recommendations
FROM "recommendations"
WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid;
