-- Supabase SQL Editor data seed chunk 04: answer to module mappings
-- Generated only from src/lib/db/seed/career-config-v2.json.
-- DRAFT config UUID: a8ad8398-48dc-41d7-9793-5e21248be966
-- Run once, only after the preceding chunk returned expected counts.

BEGIN;

DO $seed_guard_04$
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
    OR NOT EXISTS (SELECT 1 FROM config_versions WHERE id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'Expected exactly the prepared DRAFT configuration';
  END IF;

  IF EXISTS (SELECT 1 FROM config_versions WHERE status = 'PUBLISHED') THEN
    RAISE EXCEPTION 'PUBLISHED configuration must not exist during seed bootstrap';
  END IF;

  IF (SELECT count(*) FROM "answers" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 75 THEN
    RAISE EXCEPTION 'Expected 75 answers before inserting mappings';
  END IF;
  IF (SELECT count(*) FROM "modules" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 11 THEN
    RAISE EXCEPTION 'Expected 11 modules before inserting mappings';
  END IF;

  IF EXISTS (SELECT 1 FROM "answer_module_weights" WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Mappings for the DRAFT already exist';
  END IF;
END
$seed_guard_04$;

INSERT INTO "answer_module_weights" (
  "id", "config_version_id", "answer_id", "module_id", "weight"
) VALUES
  ('be1016ed-63cc-4439-a0ac-1187bec35ff9'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '689c4031-ac5e-4bd4-81c3-596ea3ff0c1e'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 3),
  ('572da942-bde3-4a02-8273-31bb9c443c53'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '689c4031-ac5e-4bd4-81c3-596ea3ff0c1e'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 2),
  ('f199b6e2-4209-4936-add8-eb6cd62ec0c0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '4e6a3438-5497-4f8a-a70a-d708d330fa32'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 3),
  ('f693ffd1-f99a-4e12-ae8a-a9c2333a6227'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '4e6a3438-5497-4f8a-a70a-d708d330fa32'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 1),
  ('b3d0e127-8c2f-4c79-8011-0964d3be2a65'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '4e6a3438-5497-4f8a-a70a-d708d330fa32'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 1),
  ('beaa1331-e9b1-4a32-bc10-003f60be147e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '5782c834-a000-49d7-8e7c-50abde2d4e76'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 3),
  ('bee0dc34-7748-4e55-a694-c3e8c9a8ddc0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '5782c834-a000-49d7-8e7c-50abde2d4e76'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 2),
  ('fdc4b408-b1b9-4279-ba73-b46740513162'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '5782c834-a000-49d7-8e7c-50abde2d4e76'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, 1),
  ('baab0698-3f2f-413e-b222-f0acbbcf654a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c43a2044-8122-450d-9321-9a84f1e8a3cd'::uuid, 'b7b07de7-e0cc-43a7-9443-dcdc438926a0'::uuid, 3),
  ('c5e8f55b-8f8f-40c2-9079-44ec78995374'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c43a2044-8122-450d-9321-9a84f1e8a3cd'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, 2),
  ('de6cffa0-0bf9-4036-836a-110fb25a12bb'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '6f7a6dd4-cde1-4ef0-b61f-c13542459686'::uuid, 'a07f8db3-8f3a-4471-99e3-444514598ebc'::uuid, 4),
  ('dca1a670-b2a3-4625-a5b2-d68540243f26'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'e10d7d4a-41f8-4b5e-b862-636c1dc771c7'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, 4),
  ('686ed670-0c8b-4631-9648-e89b48696f1b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'e10d7d4a-41f8-4b5e-b862-636c1dc771c7'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, 1),
  ('abc1349e-30bf-42e8-9fc0-d43bbb5381ec'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '7cfb771f-2650-4120-a236-a37568e05884'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 4),
  ('de8b0602-d84f-4c39-84d6-0d19c05d809a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '7cfb771f-2650-4120-a236-a37568e05884'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, 1),
  ('ef41e0b6-144c-4843-81bb-936fded3c7ff'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '4a8bf1a3-7ab9-4831-83f3-9d4859d40d63'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 4),
  ('4755a1ea-08b1-40ce-bc27-439b56534dba'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '4a8bf1a3-7ab9-4831-83f3-9d4859d40d63'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 2),
  ('c42ff3d5-2d4c-4311-abec-94f9e6034f85'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2b33fd99-69f3-47d3-ae8e-fd8e26c5e5e8'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 5),
  ('a18c112b-1a8a-41d4-bbd3-6266ab5e9b2b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2b33fd99-69f3-47d3-ae8e-fd8e26c5e5e8'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, 2),
  ('ba270b2d-6674-41ca-b540-d414649a9181'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'b50f81cd-b844-4df3-8c80-770b1b5cb438'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 5),
  ('94f8fc0f-746e-484e-b7fb-5ffea69051a0'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '372c5387-9b15-41d1-b4e7-ee32860aa752'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 5),
  ('bb368461-9d06-400d-b0a7-bed8586f72a3'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '29dd13aa-0fe4-410e-8c65-719bd58eb398'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, 5),
  ('f68edb4c-6767-4759-bfe2-d5a50383f269'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c51459fd-849d-4041-ad5c-e80511d94f77'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, 5),
  ('f1bee42e-5426-4188-abfe-fba13bd49406'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '9b4dbede-ef47-419f-9ff9-cdb103f4a823'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 5),
  ('034d0ee6-a71d-4a7c-b3ae-a6748e814b94'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'aeb9effc-3454-423d-900c-ce76ae98fc68'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 5),
  ('c8816356-8e73-4b39-b40f-d0022b1e770e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'aeb9effc-3454-423d-900c-ce76ae98fc68'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 2),
  ('26764918-d7ce-4f53-98e3-2c7a22780c2d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2585eed4-57a2-4be4-91fb-d86c5af216da'::uuid, 'b7b07de7-e0cc-43a7-9443-dcdc438926a0'::uuid, 5),
  ('343bc5ca-21ee-4f72-a9d8-ef86160e2b77'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '3376a834-3ea4-4e54-918f-8635e9c08d9f'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, 5),
  ('fe6096cb-c583-439d-b06a-0e2d9613a619'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '1edfb895-7176-4445-a183-c041a3b442b4'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, 5),
  ('31a1ac07-377b-4cf9-8b96-e7057e3b940f'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ac03dbae-91d8-4bb2-8e32-8ddce0758fb2'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, 5),
  ('57c8e354-02de-40e0-90c2-254ec9c9022f'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'af0f31e6-e394-4f17-a616-5412a5cccd39'::uuid, 'a07f8db3-8f3a-4471-99e3-444514598ebc'::uuid, 5),
  ('e47dddbc-e3a7-4cbc-9bc4-26088d2d9b20'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '1ded2ba1-2c30-4d34-ab85-b53d158c4817'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 5),
  ('f3b35b5b-b059-4ff9-8dfb-061c7209e83b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '25f8c667-ba34-4baa-9b76-450ff074d8b3'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 5),
  ('f8a3bbe5-df4c-41a8-bbc9-b5430c9fd3a5'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '00b938b4-4be7-42db-b232-84d9f11cefb7'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 4),
  ('bb3684b3-3633-4ba3-829c-a267b8e0a643'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'e63e49cf-7a74-4297-a59d-41c0f5e87bc2'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 4),
  ('9e81f18e-f68a-4046-b5b8-7d84a93ee6d3'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '7496ae56-10a6-4386-90e3-c6889b852b18'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 4),
  ('72be43f0-eb70-49f2-afb9-d8327b231ee1'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '99e0caa0-914b-4967-96b1-e3446a37c434'::uuid, '49099f86-cde7-41f4-8337-9814c96e8171'::uuid, 4),
  ('dea68a47-7ef5-46cc-8561-c17f92b103d2'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0c17faa8-2b26-4697-8f00-9c10b8c8d647'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 4),
  ('1f2558a4-e9b4-4448-88d7-b73bf041c0b5'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '7ad8246d-875b-4d20-9d8a-a60d1ca7f9c1'::uuid, '29c914e6-d8e3-4e54-ae5d-cac848b5113a'::uuid, 3),
  ('c92c27f2-b3fb-44f5-9899-96dc7fa3730e'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'ec4221b2-d066-48c6-94a1-8c455405956d'::uuid, 'b7b07de7-e0cc-43a7-9443-dcdc438926a0'::uuid, 4),
  ('6a75feae-b99e-4f71-a62f-360fb1649fa2'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0069214d-ae23-4553-b881-da349d10b76b'::uuid, 'cb541dc5-5aa1-4839-987f-2649721c8335'::uuid, 4),
  ('d816bf9b-e009-48bd-9ff4-20826e489ade'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'c33362c3-1609-4337-9e55-ff302c4dd4a1'::uuid, 'a7372a1b-aa2c-4a10-a0e8-59b954b67873'::uuid, 4),
  ('33ee3683-00f4-4e74-b33a-997080b634e1'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '50558362-3eb2-47b8-9d74-13d2c9021e25'::uuid, 'a07f8db3-8f3a-4471-99e3-444514598ebc'::uuid, 4),
  ('609a76f3-f43f-4607-a783-77d4d5294b67'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '0e8e6a63-d23c-4307-91aa-443723719e54'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, 4),
  ('19e70f01-8ba1-49d7-ad17-0c2c5c6c8111'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '2d972f17-50fe-4e26-bb0a-cafe89f5d359'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 4),
  ('5b5e92f5-a2ce-48c9-99de-4b224410b32a'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '48989af9-2100-4c5a-a8a4-7ce5e6b24500'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 1),
  ('24f696a7-e2c0-4fe5-a156-3b705cb36bc8'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'f63dda34-68cd-44aa-842f-59edfce2fa9e'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 2),
  ('8824e5fb-5feb-43dd-87bb-5b8e32400f07'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'f63dda34-68cd-44aa-842f-59edfce2fa9e'::uuid, 'c120fd77-8e3a-4fe2-8389-e70b5b299b5e'::uuid, 1),
  ('146aacc9-0ccf-4bdb-b39d-86ed02779387'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '869d6553-8ea5-4625-a7e1-034d13dda45c'::uuid, 'c46d9f3e-b112-4c1a-82ef-3680db034884'::uuid, 1),
  ('d6caadec-fee2-4205-b3b8-4482ceb6856c'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '869d6553-8ea5-4625-a7e1-034d13dda45c'::uuid, 'eca9a37e-c5a4-4d11-8eb3-d303d8e30ea5'::uuid, 1),
  ('c45af8a6-be16-40ed-98c1-47e9ccd7554b'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'd416a30e-a209-474a-815e-fd639d7c10dd'::uuid, '2798ef0f-a63a-48bd-8ea4-1df819a723b3'::uuid, 4),
  ('1a507f57-a543-4f11-8ee0-47810862330d'::uuid, 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, '52541f64-ae96-47a2-b207-9f712e9263a8'::uuid, '0cd9435d-13d4-44a1-85a9-092a4abaf888'::uuid, 2);

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '04' AS chunk,
  count(*)::integer AS mappings
FROM "answer_module_weights"
WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid;
