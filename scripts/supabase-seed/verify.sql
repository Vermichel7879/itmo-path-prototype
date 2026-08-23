-- Final read-only verification for DRAFT config a8ad8398-48dc-41d7-9793-5e21248be966.
WITH target AS (
  SELECT 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid AS config_id
)
SELECT
  (SELECT count(*)::integer FROM config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*)::integer FROM config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*)::integer FROM questions, target WHERE config_version_id = target.config_id) AS questions,
  (SELECT count(*)::integer FROM answers, target WHERE config_version_id = target.config_id) AS answers,
  (SELECT count(*)::integer FROM answer_module_weights, target WHERE config_version_id = target.config_id) AS mappings,
  (SELECT count(*)::integer FROM modules, target WHERE config_version_id = target.config_id) AS modules,
  (SELECT count(*)::integer FROM recommendations, target WHERE config_version_id = target.config_id) AS recommendations,
  (SELECT count(*)::integer FROM module_recommendations, target WHERE config_version_id = target.config_id) AS module_recommendations,
  (SELECT count(*)::integer FROM modifiers, target WHERE config_version_id = target.config_id) AS modifiers,
  (SELECT count(*)::integer FROM entrepreneur_stages, target WHERE config_version_id = target.config_id) AS entrepreneur_stages,
  (SELECT count(*)::integer FROM entrepreneur_challenges, target WHERE config_version_id = target.config_id) AS entrepreneur_challenges,
  (SELECT count(*)::integer FROM answers a JOIN questions q ON q.id = a.question_id AND q.config_version_id = a.config_version_id, target WHERE a.config_version_id = target.config_id AND q.stable_id = 'Q9') AS q9_answers,
  (SELECT count(*)::integer FROM answers a JOIN questions q ON q.id = a.question_id AND q.config_version_id = a.config_version_id, target WHERE a.config_version_id = target.config_id AND q.stable_id = 'Q10') AS q10_answers,
  EXISTS (SELECT 1 FROM questions, target WHERE config_version_id = target.config_id AND stable_id = 'Q1') AS q1_exists,
  EXISTS (SELECT 1 FROM questions, target WHERE config_version_id = target.config_id AND stable_id = 'Q2') AS q2_exists,
  EXISTS (SELECT 1 FROM questions, target WHERE config_version_id = target.config_id AND stable_id = 'Q10') AS q10_exists,
  EXISTS (SELECT 1 FROM modules, target WHERE config_version_id = target.config_id AND stable_id = 'M01') AS m01_exists,
  EXISTS (SELECT 1 FROM modules, target WHERE config_version_id = target.config_id AND stable_id = 'M02') AS m02_exists,
  EXISTS (SELECT 1 FROM modules, target WHERE config_version_id = target.config_id AND stable_id = 'M11') AS m11_exists,
  EXISTS (
    SELECT 1
    FROM answer_module_weights w
    JOIN answers a ON a.id = w.answer_id AND a.config_version_id = w.config_version_id
    JOIN modules m ON m.id = w.module_id AND m.config_version_id = w.config_version_id, target
    WHERE w.config_version_id = target.config_id
      AND a.stable_id = 'Q5_A4'
      AND m.stable_id = 'M11'
      AND w.weight = 4
  ) AS q5_a4_to_m11_exists,
  (SELECT count(*)::integer FROM (SELECT stable_id FROM questions, target WHERE config_version_id = target.config_id GROUP BY stable_id HAVING count(*) > 1) duplicates) AS duplicate_question_ids,
  (SELECT count(*)::integer FROM (SELECT stable_id FROM answers, target WHERE config_version_id = target.config_id GROUP BY stable_id HAVING count(*) > 1) duplicates) AS duplicate_answer_ids,
  (SELECT count(*)::integer FROM (SELECT stable_id FROM modules, target WHERE config_version_id = target.config_id GROUP BY stable_id HAVING count(*) > 1) duplicates) AS duplicate_module_ids,
  (
    SELECT count(*)::integer
    FROM answer_module_weights w
    LEFT JOIN answers a ON a.id = w.answer_id AND a.config_version_id = w.config_version_id
    LEFT JOIN modules m ON m.id = w.module_id AND m.config_version_id = w.config_version_id, target
    WHERE w.config_version_id = target.config_id
      AND (a.id IS NULL OR m.id IS NULL)
  ) AS broken_mappings;
