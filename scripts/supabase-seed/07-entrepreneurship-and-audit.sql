-- Supabase SQL Editor data seed chunk 07: entrepreneurship and audit
-- Generated only from src/lib/db/seed/career-config-v2.json.
-- DRAFT config UUID: a8ad8398-48dc-41d7-9793-5e21248be966
-- Run once, only after the preceding chunk returned expected counts.

BEGIN;

DO $seed_guard_07$
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
    OR NOT EXISTS (SELECT 1 FROM config_versions WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'Expected exactly the prepared DRAFT configuration';
  END IF;

  IF EXISTS (SELECT 1 FROM config_versions WHERE status = 'PUBLISHED') THEN
    RAISE EXCEPTION 'PUBLISHED configuration must not exist during seed bootstrap';
  END IF;

  IF (SELECT count(*) FROM "answers" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 75 THEN
    RAISE EXCEPTION 'Expected 75 answers before inserting entrepreneurship data';
  END IF;
  IF (SELECT count(*) FROM "modules" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 11 THEN
    RAISE EXCEPTION 'Expected 11 modules before inserting entrepreneurship data';
  END IF;
  IF (SELECT count(*) FROM "recommendations" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 22 THEN
    RAISE EXCEPTION 'Expected 22 recommendations before inserting entrepreneurship data';
  END IF;

  IF EXISTS (SELECT 1 FROM "entrepreneur_stages" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Entrepreneur stages for the DRAFT already exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "entrepreneur_challenges" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Entrepreneur challenges for the DRAFT already exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "audit_log" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND action = 'IMPORT_DRAFT') THEN
    RAISE EXCEPTION 'DRAFT import audit entry already exists';
  END IF;
END
$seed_guard_07$;

INSERT INTO "entrepreneur_stages" (
  "id", "config_version_id", "stable_id", "answer_id", "target_module_id", "answer_text", "focus", "step_1", "step_2", "step_3", "checkpoint", "sort_order", "active"
) VALUES
  ('eb2740e8-ac19-4c2f-bdb1-fa1959451a0b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_stage_interest', 'df0b0494-0e3b-48d8-b552-3321dbf5ab68'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'Только интересуюсь: конкретной идеи пока нет', 'Найти проблему, а не «придумать стартап»', 'Выберите 2–3 области, которые хорошо знаете по учёбе, работе или личному опыту.', 'Проведите по 3–5 коротких разговоров с людьми из каждой области о регулярных проблемах.', 'Выберите одну проблему по частоте, остроте и доступности аудитории для дальнейшей проверки.', 'Есть одна проблема и понятный сегмент людей, с которыми можно продолжить проверку.', 1, TRUE),
  ('e3b2cee8-0fd0-4d3e-bedb-204cbb8d5b0d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_stage_idea', 'f3701bf7-6ef1-4957-9a4a-35a8f3f1f974'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'Есть идея, но я её ещё не проверял(а)', 'Проверить проблему и спрос до разработки', 'Сформулируйте гипотезу: кто пользователь, какая у него проблема, что он делает сейчас.', 'Проведите 5–10 проблемных интервью и зафиксируйте повторяющиеся паттерны.', 'Сделайте один минимальный тест спроса без полноценной разработки.', 'Есть факты, подтверждающие/опровергающие проблему и следующий эксперимент.', 2, TRUE),
  ('8f6e927d-c4b1-4aed-9631-29f5c76a19e6'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_stage_validation', 'c87d1add-d156-4e2f-a0ff-8b2a21d797be'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'Проверяю спрос или делаю прототип', 'Получить измеримый сигнал от рынка', 'Определите одну главную гипотезу, которую должен проверить текущий прототип.', 'Выберите одну метрику: заявки, регистрации, пилоты, повторное использование или другой явный сигнал.', 'Проведите тест на небольшой аудитории и сравните результат с заранее заданным критерием.', 'Есть измеримый результат теста и решение: продолжать, менять или останавливать гипотезу.', 3, TRUE),
  ('0d4582ce-4c96-4c6d-a5d6-97976164d1a7'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_stage_users', '0df5b09c-5ec9-400b-921a-95881446ca4b'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'Есть первые пользователи или клиенты', 'Понять, почему люди остаются и готовы ли платить', 'Соберите обратную связь у первых пользователей: зачем пришли, что используют, что мешает.', 'Проверьте повторное использование/повторную потребность и готовность платить.', 'Зафиксируйте один узкий сегмент и один канал привлечения для следующего цикла.', 'Понятно, кто ваш наиболее перспективный пользователь и какой сигнал повторяемости вы проверяете.', 4, TRUE),
  ('d0c9f359-6a77-4cde-942a-e1fc7046c9c0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_stage_revenue', 'c7faa24f-914f-496e-b0be-905bef9d8939'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'Есть продажи / действующий проект', 'Проверить повторяемость модели, а не только факт первой продажи', 'Разберите, откуда приходят клиенты и какие сделки/пользователи наиболее качественные.', 'Посчитайте базовую экономику на уровне одной продажи или клиента.', 'Выберите одно ограничение роста: спрос, канал, продукт, команда или экономика — и поставьте эксперимент.', 'Есть базовая экономика и один приоритетный эксперимент на повышение повторяемости.', 5, TRUE);

INSERT INTO "entrepreneur_challenges" (
  "id", "config_version_id", "stable_id", "answer_id", "target_module_id", "recommendation_id", "answer_text", "trajectory_adjustment", "sort_order", "active"
) VALUES
  ('67478a9f-2354-4da7-ac8f-9f36ada7ec1d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_problem', '098f97c3-49a8-40a3-bb92-8c0bf401be5c'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'adbac3f5-8e89-46b4-97dd-e203b9aebb74'::uuid, 'Найти идею или проблему, которую стоит решать', 'Не генерировать идеи в вакууме: собрать проблемы из знакомых контекстов и проверить их частоту.', 1, TRUE),
  ('6c7d42fa-206e-4470-9da6-d98bfa77c1f2'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_customer', '14871448-07e8-4d81-8439-38e6187c2478'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'adbac3f5-8e89-46b4-97dd-e203b9aebb74'::uuid, 'Понять, кто моя аудитория и что ей действительно нужно', 'Сузить сегмент и провести интервью о реальном поведении, а не о гипотетическом интересе.', 2, TRUE),
  ('d90896e8-cff7-4fe8-98fe-3c0be7fd3f1e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_demand', 'a55ee931-b28a-4cb9-a949-fa21dc0d2a03'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '899f58ef-ff39-422f-ab8a-30f756a5f7e4'::uuid, 'Проверить, есть ли реальный спрос', 'Сделать минимальный тест с измеримым действием пользователя: заявка, пилот, предзаказ, регистрация.', 3, TRUE),
  ('906b217f-9463-4625-86b6-859a4883e2d5'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_mvp', '1bc5777a-de85-4b81-8117-dd12655dce0b'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '899f58ef-ff39-422f-ab8a-30f756a5f7e4'::uuid, 'Сделать первый прототип / MVP', 'Собрать только то, что нужно для проверки одной ключевой гипотезы; не делать «полный продукт».', 4, TRUE),
  ('a9d3ba1f-f286-4451-8937-5e7aa21bbc6c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_team', '5f2405ce-53fa-40a5-9675-bcdac75fde2b'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '62aa944d-446f-4d4a-99b5-0ad321179d03'::uuid, 'Найти команду или недостающие компетенции', 'Сначала описать конкретную недостающую роль и ближайшую задачу; искать человека под эксперимент, а не абстрактного сооснователя.', 5, TRUE),
  ('304ddea8-7400-47ee-a4ec-8f1fb695cb80'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_sales', '319a49c2-b7ad-4574-aa07-b2431a59f145'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '899f58ef-ff39-422f-ab8a-30f756a5f7e4'::uuid, 'Найти первых пользователей / клиентов', 'Выбрать один узкий сегмент и один доступный канал; провести серию персональных касаний вместо широкого продвижения.', 6, TRUE),
  ('15dc53c1-ad8e-40ec-a562-8cca6d27ca1c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_model', 'af03a973-3e08-43ba-b631-969eab7a9e79'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'e0e741b8-dfb7-4180-ab35-807a9aadb825'::uuid, 'Понять бизнес-модель и экономику проекта', 'Зафиксировать, кто платит, за что, сколько стоит привлечение/оказание услуги и какая метрика показывает жизнеспособность.', 7, TRUE),
  ('a53fbdec-24db-4ca9-aa36-0495227162dc'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ent_balance', '462252bb-dc6f-4172-be72-910a7bf39122'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '899f58ef-ff39-422f-ab8a-30f756a5f7e4'::uuid, 'Совмещать проект с учёбой и другими задачами', 'Работать недельными экспериментами с одной гипотезой и заранее ограниченным временем.', 8, TRUE);

INSERT INTO "audit_log" (
  "config_version_id", "action", "entity_type", "entity_id", "metadata"
) VALUES
  ('a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'IMPORT_DRAFT', 'config_version', 'a8ad8398-48dc-41d7-9793-5e21248be966', '{"sourceFileName":"Карьерная_траектория_ЦКО_источник_v2.xlsx","sourceSha256":"EFC16A1C08A5019C05962ADD9C6390FB03F9DE9A28AA56FE3495A7F1C76181F2","replacedDraftId":null}'::jsonb);

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '07' AS chunk,
  (SELECT count(*)::integer FROM entrepreneur_stages WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) AS entrepreneur_stages,
  (SELECT count(*)::integer FROM entrepreneur_challenges WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) AS entrepreneur_challenges,
  (SELECT count(*)::integer FROM audit_log WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND action = 'IMPORT_DRAFT') AS audit_entries;
