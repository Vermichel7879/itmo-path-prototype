-- Supabase SQL Editor data seed chunk 03: answers
-- Generated only from src/lib/db/seed/career-config-v2.json.
-- DRAFT config UUID: a8ad8398-48dc-41d7-9793-5e21248be966
-- Run once, only after the preceding chunk returned expected counts.

BEGIN;

DO $seed_guard_03$
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
    OR NOT EXISTS (SELECT 1 FROM config_versions WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'Expected exactly the prepared DRAFT configuration';
  END IF;

  IF EXISTS (SELECT 1 FROM config_versions WHERE status = 'PUBLISHED') THEN
    RAISE EXCEPTION 'PUBLISHED configuration must not exist during seed bootstrap';
  END IF;

  IF (SELECT count(*) FROM "questions" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 10 THEN
    RAISE EXCEPTION 'Expected 10 questions before inserting answers';
  END IF;

  IF EXISTS (SELECT 1 FROM "answers" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Answers for the DRAFT already exist';
  END IF;
END
$seed_guard_03$;

INSERT INTO "answers" (
  "id", "config_version_id", "question_id", "stable_id", "text", "sort_order", "tags", "keys", "active"
) VALUES
  ('689c4031-ac5e-4bd4-81c3-596ea3ff0c1e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A1', 'Ещё не искал(а) работу или стажировку', 1, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('4e6a3438-5497-4f8a-a70a-d708d330fa32'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A2', 'Только начинаю искать', 2, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('5782c834-a000-49d7-8e7c-50abde2d4e76'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A3', 'Активно откликаюсь', 3, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('c43a2044-8122-450d-9321-9a84f1e8a3cd'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A4', 'Уже прохожу собеседования и тестовые', 4, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('6f7a6dd4-cde1-4ef0-b61f-c13542459686'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A5', 'Выбираю между несколькими вариантами', 5, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('e10d7d4a-41f8-4b5e-b862-636c1dc771c7'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A6', 'Уже работаю/стажируюсь и хочу развиваться', 6, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('7cfb771f-2650-4120-a236-a37568e05884'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'db9fee28-5261-4d46-a9d1-3b8fe06b8e9e'::uuid, 'Q1_A7', 'Хочу запустить собственный проект или уже его развиваю', 7, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('4a8bf1a3-7ab9-4831-83f3-9d4859d40d63'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A1', 'Не понимаю, с чего начать', 1, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('2b33fd99-69f3-47d3-ae8e-fd8e26c5e5e8'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A2', 'Не понимаю, на какие позиции могу претендовать', 2, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('b50f81cd-b844-4df3-8c80-770b1b5cb438'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A3', 'Не могу найти подходящие вакансии или стажировки', 3, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('372c5387-9b15-41d1-b4e7-ee32860aa752'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A4', 'Не хватает профессионального опыта', 4, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('29dd13aa-0fe4-410e-8c65-719bd58eb398'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A5', 'Не понимаю, какие навыки нужны работодателям', 5, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('c51459fd-849d-4041-ad5c-e80511d94f77'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A6', 'Не понимаю, насколько мои навыки соответствуют рынку', 6, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('9b4dbede-ef47-419f-9ff9-cdb103f4a823'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A7', 'Сложно составить сильное резюме', 7, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('aeb9effc-3454-423d-900c-ce76ae98fc68'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A8', 'Откликаюсь, но почти не получаю приглашений', 8, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('2585eed4-57a2-4be4-91fb-d86c5af216da'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A9', 'Сложно проходить собеседования', 9, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('3376a834-3ea4-4e54-918f-8635e9c08d9f'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A10', 'Сложно выполнять тестовые задания', 10, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('1edfb895-7176-4445-a183-c041a3b442b4'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A11', 'Трудно совмещать поиск работы с учёбой', 11, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('ac03dbae-91d8-4bb2-8e32-8ddce0758fb2'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A12', 'Отказы демотивируют или страшно откликаться', 12, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('af0f31e6-e394-4f17-a616-5412a5cccd39'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A13', 'Сложно выбрать между несколькими вариантами', 13, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('1ded2ba1-2c30-4d34-ab85-b53d158c4817'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A14', 'Хочу попробовать предпринимательство, но не понимаю, с чего начать', 14, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('25f8c667-ba34-4baa-9b76-450ff074d8b3'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd0f346de-9fc0-408a-844d-e53275efd805'::uuid, 'Q2_A15', 'Есть идея или проект, но не понимаю, как проверить спрос и двигаться дальше', 15, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('00b938b4-4be7-42db-b232-84d9f11cefb7'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A1', 'Выбрать карьерное направление', 1, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('e63e49cf-7a74-4297-a59d-41c0f5e87bc2'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A2', 'Найти работу или стажировку', 2, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('7496ae56-10a6-4386-90e3-c6889b852b18'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A3', 'Получить первый профессиональный опыт', 3, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('99e0caa0-914b-4967-96b1-e3446a37c434'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A4', 'Понять, какие навыки развивать', 4, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('0c17faa8-2b26-4697-8f00-9c10b8c8d647'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A5', 'Составить или улучшить резюме', 5, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('7ad8246d-875b-4d20-9d8a-a60d1ca7f9c1'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A6', 'Научиться писать отклики и сопроводительные', 6, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('ec4221b2-d066-48c6-94a1-8c455405956d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A7', 'Подготовиться к собеседованиям', 7, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('0069214d-ae23-4553-b881-da349d10b76b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A8', 'Лучше выполнять тестовые задания', 8, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('c33362c3-1609-4337-9e55-ff302c4dd4a1'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A9', 'Выстроить поиск без перегруза', 9, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('50558362-3eb2-47b8-9d74-13d2c9021e25'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A10', 'Выбрать стажировку или оффер', 10, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('0e8e6a63-d23c-4307-91aa-443723719e54'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A11', 'Развивать карьеру во время учёбы', 11, '[]'::jsonb, '[]'::jsonb, TRUE),
  ('2d972f17-50fe-4e26-bb0a-cafe89f5d359'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '93cf6282-9d47-47d8-8a05-c1996d5bebfd'::uuid, 'Q3_A12', 'Проверить идею или запустить собственный проект', 12, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('712fce77-86e7-489e-967c-9925d24bd66a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A1', 'Есть понятная целевая роль или направление', 1, '["validate_direction"]'::jsonb, '["validate_direction"]'::jsonb, TRUE),
  ('902a569c-08e5-4d67-a385-b794e7f15578'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A2', 'Есть актуальное резюме', 2, '["resume_audit"]'::jsonb, '["resume_audit"]'::jsonb, TRUE),
  ('5d043a9c-9941-4845-b08c-ae2c2da3555e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A3', 'Есть портфолио / GitHub / кейсы', 3, '["evidence_exists"]'::jsonb, '["evidence_exists"]'::jsonb, TRUE),
  ('e74bdfb3-da98-43b6-9100-d9e0c67e971a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A4', 'Есть опыт проектов / практики / стажировки', 4, '["package_experience"]'::jsonb, '["package_experience"]'::jsonb, TRUE),
  ('c1c3de06-e02f-4d3c-92d9-bd6269c5bdc9'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A5', 'Есть список интересующих компаний или вакансий', 5, '["search_list_exists"]'::jsonb, '["search_list_exists"]'::jsonb, TRUE),
  ('485d70ff-2f49-448d-8ec5-a1eb54d314fa'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A6', 'Есть идея собственного проекта', 6, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('670f9afa-830f-45c9-acb6-eea29c72e3af'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6a02ab67-a188-45b3-bf4a-4c4e68183555'::uuid, 'Q4_A7', 'Есть прототип, пользователи или первые продажи', 7, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('48989af9-2100-4c5a-a8a4-7ce5e6b24500'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '82ce6d0f-475f-43fa-bdbd-a2ad2a852fcd'::uuid, 'Q5_A1', 'Работа в компании', 1, '["employment"]'::jsonb, '["employment"]'::jsonb, TRUE),
  ('f63dda34-68cd-44aa-842f-59edfce2fa9e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '82ce6d0f-475f-43fa-bdbd-a2ad2a852fcd'::uuid, 'Q5_A2', 'Стажировка / практика', 2, '["internship"]'::jsonb, '["internship"]'::jsonb, TRUE),
  ('869d6553-8ea5-4625-a7e1-034d13dda45c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '82ce6d0f-475f-43fa-bdbd-a2ad2a852fcd'::uuid, 'Q5_A3', 'Проектная работа / фриланс', 3, '["project_work"]'::jsonb, '["project_work"]'::jsonb, TRUE),
  ('d416a30e-a209-474a-815e-fd639d7c10dd'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '82ce6d0f-475f-43fa-bdbd-a2ad2a852fcd'::uuid, 'Q5_A4', 'Собственный проект / предпринимательство', 4, '["entrepreneur_signal"]'::jsonb, '["entrepreneur_signal"]'::jsonb, TRUE),
  ('52541f64-ae96-47a2-b207-9f712e9263a8'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '82ce6d0f-475f-43fa-bdbd-a2ad2a852fcd'::uuid, 'Q5_A5', 'Пока не определился(ась)', 5, '["undecided"]'::jsonb, '["undecided"]'::jsonb, TRUE),
  ('073492fa-61fe-472e-8d4f-4b4647e7f626'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A1', 'Интересные и содержательные задачи', 1, '["priority_tasks"]'::jsonb, '["priority_tasks"]'::jsonb, TRUE),
  ('0dc307fe-c07f-41d5-a88f-46dedfec3abf'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A2', 'Быстрое развитие навыков', 2, '["priority_growth"]'::jsonb, '["priority_growth"]'::jsonb, TRUE),
  ('144795bc-15e7-43e9-b23c-e518550f7c35'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A3', 'Доход', 3, '["priority_income"]'::jsonb, '["priority_income"]'::jsonb, TRUE),
  ('ba50d185-4acc-4a54-b2fe-082d2541e916'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A4', 'Гибкий график и возможность совмещать с учёбой', 4, '["priority_flex"]'::jsonb, '["priority_flex"]'::jsonb, TRUE),
  ('f145d2bd-a73d-4e5f-af3d-8c142e48b184'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A5', 'Стабильность и понятные условия', 5, '["priority_stability"]'::jsonb, '["priority_stability"]'::jsonb, TRUE),
  ('2ec92b85-65e1-4993-856f-0155b2736c5e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A6', 'Сильная команда или наставник', 6, '["priority_team"]'::jsonb, '["priority_team"]'::jsonb, TRUE),
  ('c93b2abc-e453-48d6-a3fb-f674aa7d434d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bc319ff0-56a0-4fe9-be54-828deeda35b4'::uuid, 'Q6_A7', 'Самостоятельность и влияние на результат', 7, '["priority_autonomy"]'::jsonb, '["priority_autonomy"]'::jsonb, TRUE),
  ('f131a45e-6972-4bae-8079-1ac9a50d5b80'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd7fdb556-d7a0-440e-99a7-759ce4e7347b'::uuid, 'Q7_A1', 'До 1 часа', 1, '["pace_light"]'::jsonb, '["pace_light"]'::jsonb, TRUE),
  ('9e8da742-c177-4ede-a26c-701a34b0a901'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd7fdb556-d7a0-440e-99a7-759ce4e7347b'::uuid, 'Q7_A2', '2–3 часа', 2, '["pace_normal"]'::jsonb, '["pace_normal"]'::jsonb, TRUE),
  ('2114e715-0a68-4c61-9cb7-112d896d4edf'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd7fdb556-d7a0-440e-99a7-759ce4e7347b'::uuid, 'Q7_A3', '4–6 часов', 3, '["pace_active"]'::jsonb, '["pace_active"]'::jsonb, TRUE),
  ('9ef153b1-2f06-4e90-a8a6-3ca5142e2f31'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd7fdb556-d7a0-440e-99a7-759ce4e7347b'::uuid, 'Q7_A4', '7 часов и больше', 4, '["pace_intensive"]'::jsonb, '["pace_intensive"]'::jsonb, TRUE),
  ('e267c694-b5cf-4d60-9579-a283eba4af3e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '9b20b8b6-6691-4d94-8be2-ac83922f890a'::uuid, 'Q8_A1', 'Короткие материалы, подборки, чек-листы', 1, '["support_materials"]'::jsonb, '["support_materials"]'::jsonb, TRUE),
  ('469983e8-ad87-4fb4-98f9-b9bbf5c40533'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '9b20b8b6-6691-4d94-8be2-ac83922f890a'::uuid, 'Q8_A2', 'Индивидуальная помощь', 2, '["support_individual"]'::jsonb, '["support_individual"]'::jsonb, TRUE),
  ('86e11fc0-eee3-47db-a066-b4451f91612d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '9b20b8b6-6691-4d94-8be2-ac83922f890a'::uuid, 'Q8_A3', 'Живые мероприятия', 3, '["support_events"]'::jsonb, '["support_events"]'::jsonb, TRUE),
  ('c0d6355b-0964-4d3c-86fb-5093e03bb01c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '9b20b8b6-6691-4d94-8be2-ac83922f890a'::uuid, 'Q8_A4', 'Практика, проекты и сообщества', 4, '["support_practice"]'::jsonb, '["support_practice"]'::jsonb, TRUE),
  ('4a5c3267-5d99-4653-8f7a-ef0156a3f8d4'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '9b20b8b6-6691-4d94-8be2-ac83922f890a'::uuid, 'Q8_A5', 'Не важно', 5, '["support_any"]'::jsonb, '["support_any"]'::jsonb, TRUE),
  ('df0b0494-0e3b-48d8-b552-3321dbf5ab68'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bd397e4f-f98c-4a38-9d3d-665d291d5cbc'::uuid, 'Q9_A1', 'Только интересуюсь: конкретной идеи пока нет', 1, '["ent_stage_interest"]'::jsonb, '["ent_stage_interest"]'::jsonb, TRUE),
  ('f3701bf7-6ef1-4957-9a4a-35a8f3f1f974'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bd397e4f-f98c-4a38-9d3d-665d291d5cbc'::uuid, 'Q9_A2', 'Есть идея, но я её ещё не проверял(а)', 2, '["ent_stage_idea"]'::jsonb, '["ent_stage_idea"]'::jsonb, TRUE),
  ('c87d1add-d156-4e2f-a0ff-8b2a21d797be'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bd397e4f-f98c-4a38-9d3d-665d291d5cbc'::uuid, 'Q9_A3', 'Проверяю спрос или делаю прототип', 3, '["ent_stage_validation"]'::jsonb, '["ent_stage_validation"]'::jsonb, TRUE),
  ('0df5b09c-5ec9-400b-921a-95881446ca4b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bd397e4f-f98c-4a38-9d3d-665d291d5cbc'::uuid, 'Q9_A4', 'Есть первые пользователи или клиенты', 4, '["ent_stage_users"]'::jsonb, '["ent_stage_users"]'::jsonb, TRUE),
  ('c7faa24f-914f-496e-b0be-905bef9d8939'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'bd397e4f-f98c-4a38-9d3d-665d291d5cbc'::uuid, 'Q9_A5', 'Есть продажи / действующий проект', 5, '["ent_stage_revenue"]'::jsonb, '["ent_stage_revenue"]'::jsonb, TRUE),
  ('098f97c3-49a8-40a3-bb92-8c0bf401be5c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A1', 'Найти идею или проблему, которую стоит решать', 1, '["ent_problem"]'::jsonb, '["ent_problem"]'::jsonb, TRUE),
  ('14871448-07e8-4d81-8439-38e6187c2478'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A2', 'Понять, кто моя аудитория и что ей действительно нужно', 2, '["ent_customer"]'::jsonb, '["ent_customer"]'::jsonb, TRUE),
  ('a55ee931-b28a-4cb9-a949-fa21dc0d2a03'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A3', 'Проверить, есть ли реальный спрос', 3, '["ent_demand"]'::jsonb, '["ent_demand"]'::jsonb, TRUE),
  ('1bc5777a-de85-4b81-8117-dd12655dce0b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A4', 'Сделать первый прототип / MVP', 4, '["ent_mvp"]'::jsonb, '["ent_mvp"]'::jsonb, TRUE),
  ('5f2405ce-53fa-40a5-9675-bcdac75fde2b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A5', 'Найти команду или недостающие компетенции', 5, '["ent_team"]'::jsonb, '["ent_team"]'::jsonb, TRUE),
  ('319a49c2-b7ad-4574-aa07-b2431a59f145'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A6', 'Найти первых пользователей / клиентов', 6, '["ent_sales"]'::jsonb, '["ent_sales"]'::jsonb, TRUE),
  ('af03a973-3e08-43ba-b631-969eab7a9e79'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A7', 'Понять бизнес-модель и экономику проекта', 7, '["ent_model"]'::jsonb, '["ent_model"]'::jsonb, TRUE),
  ('462252bb-dc6f-4172-be72-910a7bf39122'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '07160ffe-c26c-4b1d-8141-bf53eb7cee13'::uuid, 'Q10_A8', 'Совмещать проект с учёбой и другими задачами', 8, '["ent_balance"]'::jsonb, '["ent_balance"]'::jsonb, TRUE);

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '03' AS chunk,
  count(*)::integer AS answers
FROM "answers"
WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid;
