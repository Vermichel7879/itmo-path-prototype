# Supabase SQL Editor data seed

This seed creates one DRAFT configuration. It does not create PUBLISHED configurations or admin users and does not change Drizzle migration history.

DRAFT UUID: a8ad8398-48dc-41d7-9793-5e21248be966

Run each file exactly once in a new Supabase SQL Editor query:

1. 01-draft-config.sql -> Run -> expect draft_configs = 1 and published_configs = 0.
2. 02-modules-and-questions.sql -> Run -> expect modules = 11 and questions = 10.
3. 03-answers.sql -> Run -> expect answers = 75.
4. 04-answer-module-weights.sql -> Run -> expect mappings = 52.
5. 05-recommendations.sql -> Run -> expect recommendations = 22.
6. 06-links-and-modifiers.sql -> Run -> expect module_recommendations = 51 and modifiers = 12.
7. 07-entrepreneurship-and-audit.sql -> Run -> expect entrepreneur_stages = 5, entrepreneur_challenges = 8, and audit_entries = 1.
8. verify.sql -> Run -> compare the single returned row with the expected counts below.

Final expected counts: DRAFT 1, PUBLISHED 0, questions 10, answers 75, mappings 52, modules 11, recommendations 22, module recommendations 51, modifiers 12, entrepreneur stages 5, entrepreneur challenges 8, Q9 answers 5, Q10 answers 8. All requested existence booleans must be true. Duplicate and broken mapping counts must be 0.

If any chunk reports an error, timeout, or unexpected count, do not run it again and do not proceed to later chunks. Send the complete SQL Editor error for diagnosis.
