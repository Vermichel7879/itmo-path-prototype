-- Supabase SQL Editor data seed chunk 06: module recommendation links and modifiers
-- Generated only from src/lib/db/seed/career-config-v2.json.
-- DRAFT config UUID: a8ad8398-48dc-41d7-9793-5e21248be966
-- Run once, only after the preceding chunk returned expected counts.

BEGIN;

DO $seed_guard_06$
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
    OR NOT EXISTS (SELECT 1 FROM config_versions WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'Expected exactly the prepared DRAFT configuration';
  END IF;

  IF EXISTS (SELECT 1 FROM config_versions WHERE status = 'PUBLISHED') THEN
    RAISE EXCEPTION 'PUBLISHED configuration must not exist during seed bootstrap';
  END IF;

  IF (SELECT count(*) FROM "modules" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 11 THEN
    RAISE EXCEPTION 'Expected 11 modules before inserting recommendation links';
  END IF;
  IF (SELECT count(*) FROM "recommendations" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 22 THEN
    RAISE EXCEPTION 'Expected 22 recommendations before inserting links';
  END IF;
  IF (SELECT count(*) FROM "answers" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 75 THEN
    RAISE EXCEPTION 'Expected 75 answers before inserting modifiers';
  END IF;

  IF EXISTS (SELECT 1 FROM "module_recommendations" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Module recommendation links for the DRAFT already exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "modifiers" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Modifiers for the DRAFT already exist';
  END IF;
END
$seed_guard_06$;

INSERT INTO "module_recommendations" (
  "id", "config_version_id", "module_id", "recommendation_id", "priority"
) VALUES
  ('74a602df-5d80-41d1-b3ac-244f4cb18dae'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 1),
  ('f445f6fb-dd23-465b-ad12-8c900f720ae4'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 2),
  ('0516c121-98fd-4a26-8ba6-2ca4cb39da0d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 3),
  ('73a13953-d398-4900-ba08-67ef122a8f14'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, '8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 4),
  ('1433304f-9e74-478a-b9e6-eb6800ebf861'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, '9db4739c-7ce6-469c-b0c4-3277d22e39bb'::uuid, 5),
  ('929a7cb0-aee7-4e97-ade9-64333d1cc67a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, '4e213155-776e-4d79-876a-8e8558f1b18b'::uuid, 1),
  ('de4c2c7f-248a-4267-a6bc-e656b44ee9a3'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 'edef4c98-93d0-4c9a-984e-adae108413d3'::uuid, 2),
  ('6a8a14e7-5da8-409d-8632-69705f36a223'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 3),
  ('19f59527-49b5-4df3-8a54-a16a11056343'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 4),
  ('2df0be6c-99e5-4fc6-8c77-a7160d5b54ac'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, '54b66cf5-d442-49c8-892b-8125bf079a41'::uuid, 5),
  ('ffca49c5-5d53-474c-8b7b-966dce2d6a27'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 'e43927f1-b5f1-4568-a976-d1e9cfb5dceb'::uuid, 1),
  ('298c5067-e0aa-49b0-b455-2f93c9eadccb'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 'edef4c98-93d0-4c9a-984e-adae108413d3'::uuid, 2),
  ('dfbe56ca-b4c0-4344-a1b9-567a66977b2b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, '8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 3),
  ('2966d4c1-28c6-4adb-bd78-8e2a4d970ebb'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 4),
  ('1a3163dc-f2ed-4559-a102-214bec5bc403'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 5),
  ('09c67ad3-8f84-49df-9996-17f48ae9833a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, '3277da5f-bbd5-4310-906e-feadc194e368'::uuid, 6),
  ('b9b66a65-0de6-4c3b-829a-6a0c4b3d28b7'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 1),
  ('69f5434b-5e78-45cf-957c-a600ee9a4b1f'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 2),
  ('e40fcd11-24a4-4426-ac17-481907d716a3'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 3),
  ('7e258980-b0f1-47bb-9d47-b7421a6c8618'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, '8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 4),
  ('99719104-762f-4494-9714-44f93cc50194'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, '83fa4b1e-7f37-45a7-b57c-9e87cb3b1dad'::uuid, 5),
  ('c7b2c728-e5aa-45d3-90cc-ffcae5c4ab75'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, '0361951b-66f3-48bf-816b-034a5bd21ddb'::uuid, 1),
  ('8f5c2024-d5f1-4bb7-99d1-f1236d6a5c80'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 2),
  ('601085b2-7ada-4f73-b2aa-0aa442dea7d2'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 3),
  ('3e05c3e0-dba5-438a-abec-827bbf0e72fe'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 'fa89e155-3588-48a7-ba6e-907ed60102ce'::uuid, 4),
  ('4fd73ef3-68c2-490c-ac1d-76867c86de9d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'b7b07de7-e0cc-43a7-9443-dcdc438926a0'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 1),
  ('b9ddcaf5-3ced-4c6b-8c52-166eb7b500cd'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'b7b07de7-e0cc-43a7-9443-dcdc438926a0'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 2),
  ('fc86128b-2aeb-4ab6-a9a8-8beb3bc2102b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'b7b07de7-e0cc-43a7-9443-dcdc438926a0'::uuid, '0c8850e3-10df-4645-9431-aa8fc718bdca'::uuid, 3),
  ('e9ad58ac-dea5-40b0-bbcf-50363094fd6b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 1),
  ('52277569-80e7-453f-b180-0cad63d759d0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, '8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 2),
  ('32465472-8931-44b1-8652-ffceb4a16fab'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 3),
  ('8f69ee22-1655-4db3-92c4-bb6f3100a397'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, '09a6cf48-97d4-4331-af92-5d7c3a4c0722'::uuid, 4),
  ('48159aca-2ce9-4a05-9f02-7b082d7e24ee'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, '4e213155-776e-4d79-876a-8e8558f1b18b'::uuid, 1),
  ('9530bedf-b3f1-47cb-9d8f-7d2366e418de'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 2),
  ('e2b2c0cc-a527-4d32-a370-c31bda9dc7b9'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 3),
  ('2b3ba86b-9631-4120-8e0f-4be9648ffd2b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 4),
  ('b11cb834-a0ba-4c81-b196-c003fe5d3082'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, 'e74116e4-8142-4f64-af45-3469e5384495'::uuid, 5),
  ('e8b57e98-6c9e-41b0-95cd-2ea8f591eef0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a07f8db3-8f3a-4471-99e3-444514598ebc'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 1),
  ('5713ab03-75ab-4d48-9a9c-c83efc0d00dc'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a07f8db3-8f3a-4471-99e3-444514598ebc'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 2),
  ('8789bb66-5e26-4a55-a561-a8da3d02ba63'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'a07f8db3-8f3a-4471-99e3-444514598ebc'::uuid, '3c2226c6-f196-4850-879a-fa3620930ee1'::uuid, 3),
  ('3a0acd2e-7302-4e5d-abfb-5b2592fd649d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, '8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 1),
  ('4f9b988e-ea5f-4d59-8459-0c635425256b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 2),
  ('3fe85953-007a-4e6c-9ba6-30c11e04736e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 3),
  ('47516bb5-9ac8-416e-9520-fb854b97e9ce'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, '1911582e-a441-4d09-83b1-8e607a735444'::uuid, 4),
  ('2c9bdfd2-fbbf-4d01-8da8-23926e667bb9'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, '6a1eedba-68d7-4af4-a3ce-09d5ad06da36'::uuid, 5),
  ('803f35eb-4a44-4824-901f-70122e335177'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'c4318d09-fc2a-4644-aefa-85021f8fbf02'::uuid, 1),
  ('aac522f2-2690-4888-b5a1-954fdab4b5a6'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '8e383b3c-8c45-41c5-a886-dc1f738a127c'::uuid, 2),
  ('e21f46ce-0f7d-4a05-b5a3-cb227e2fa996'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '10b39f52-7cf4-4b03-adf8-97aab016f987'::uuid, 3),
  ('a1c3f955-9f17-4131-9ea1-3aad9c9fc4ab'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'adbac3f5-8e89-46b4-97dd-e203b9aebb74'::uuid, 4),
  ('825fe6f5-69dc-4564-b71d-8fd5bccdd397'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, '899f58ef-ff39-422f-ab8a-30f756a5f7e4'::uuid, 5),
  ('e389d913-62c4-4e2c-b31c-88b21ac020f0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'e0e741b8-dfb7-4180-ab35-807a9aadb825'::uuid, 6);

INSERT INTO "modifiers" (
  "id", "config_version_id", "stable_id", "trigger_answer_id", "trigger_answer_pattern", "trigger_tag", "target_scope", "target_module_id", "type", "variant_key", "effect", "active"
) VALUES
  ('f905a01b-5faf-45ef-8dbc-a82b19943d3b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD01', '712fce77-86e7-489e-967c-9925d24bd66a'::uuid, 'Q4_A1', NULL, 'MODULE', '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 'COPY', 'validate_direction', '{"kind":"copy","description":"Вместо «выберите направление» → «проверьте выбранную роль на реальных вакансиях»."}'::jsonb, TRUE),
  ('7094a6c2-4e6b-48de-8470-496fcc85c6d8'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD02', '902a569c-08e5-4d67-a385-b794e7f15578'::uuid, 'Q4_A2', NULL, 'MODULE', '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 'COPY', 'resume_audit', '{"kind":"copy","description":"Вместо «создайте резюме» → «проведите аудит и адаптацию актуального резюме»."}'::jsonb, TRUE),
  ('26c047c7-bebe-4569-b1ee-e72df2a4d493'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD03', '5d043a9c-9941-4845-b08c-ae2c2da3555e'::uuid, 'Q4_A3', NULL, 'MODULE', 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 'COPY', 'evidence_exists', '{"kind":"copy","description":"Вместо «создайте первый кейс» → «усильте и упакуйте существующие кейсы»."}'::jsonb, TRUE),
  ('4caf0fca-aa92-431b-b235-24aed69f10be'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD04', 'e74bdfb3-da98-43b6-9100-d9e0c67e971a'::uuid, 'Q4_A4', NULL, 'MODULE', 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 'COPY', 'package_experience', '{"kind":"copy","description":"Вместо «получите любой опыт» → «упакуйте текущий опыт и найдите следующий более сильный кейс»."}'::jsonb, TRUE),
  ('20f7c3fa-dcb0-471d-b0a3-7055b7485d2e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD05', 'c1c3de06-e02f-4d3c-92d9-bd6269c5bdc9'::uuid, 'Q4_A5', NULL, 'MODULE', 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 'COPY', 'search_list_exists', '{"kind":"copy","description":"Вместо «соберите список компаний» → «расширьте каналы и проверьте качество текущего списка»."}'::jsonb, TRUE),
  ('19d968ee-3290-4a75-b590-71c1fedb2b68'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD06', 'aeb9effc-3454-423d-900c-ce76ae98fc68'::uuid, 'Q2_A8', NULL, 'MODULE', '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 'COPY', 'ats_variant', '{"kind":"copy","description":"Добавить блок про первичный фильтр: простая структура, релевантные термины, адаптация под вакансию, контроль конверсии."}'::jsonb, TRUE),
  ('db5dd7c5-86cd-4f2d-a187-fc0a04af7aad'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD07', '485d70ff-2f49-448d-8ec5-a1eb54d314fa'::uuid, 'Q4_A6', NULL, 'MODULE', '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'COPY', 'idea_exists', '{"kind":"copy","description":"Не искать идею с нуля: перейти к формулировке аудитории, проблемы и проверке спроса."}'::jsonb, TRUE),
  ('294747a1-7164-4180-bf04-d0ba03284900'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD08', '670f9afa-830f-45c9-acb6-eea29c72e3af'::uuid, 'Q4_A7', NULL, 'MODULE', '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'COPY', 'traction_exists', '{"kind":"copy","description":"Не предлагать «первую проверку»: перейти к обратной связи пользователей, повторяемости спроса и бизнес-модели."}'::jsonb, TRUE),
  ('c683e14d-1ec3-47f3-b045-73ca764f3f4f'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD09', NULL, 'Q6_*', NULL, 'ALL', NULL, 'COPY', 'priorities', '{"kind":"copy","description":"Вывести 1–3 выбранных ориентира отдельной строкой «Для вас важно»; не менять скоринг."}'::jsonb, TRUE),
  ('e0096d7a-2e23-4cc5-bb2f-0620e4396165'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD10', NULL, 'Q7_*', NULL, 'ALL', NULL, 'PACE', 'pace', '{"kind":"pace","description":"Изменить интенсивность и частоту действий по правилам R10."}'::jsonb, TRUE),
  ('587b34e4-9adc-47a3-93d5-2efa2cc168af'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD11', NULL, 'Q9_*', NULL, 'MODULE', '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'COPY', 'ent_stage', '{"kind":"copy","description":"Выбрать стадийный вариант из листа «09_Предпринимательство»."}'::jsonb, TRUE),
  ('6ff52685-1adf-467d-8ef6-8357338ae9af'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'MOD12', NULL, 'Q10_*', NULL, 'MODULE', '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 'COPY', 'ent_challenge', '{"kind":"copy","description":"Добавить 1–2 действия по выбранным задачам из листа «09_Предпринимательство»."}'::jsonb, TRUE);

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '06' AS chunk,
  (SELECT count(*)::integer FROM module_recommendations WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) AS module_recommendations,
  (SELECT count(*)::integer FROM modifiers WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) AS modifiers;
