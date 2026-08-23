-- Versioned documentation examples E01-E07. Run once.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM engine_rules WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 17 THEN
    RAISE EXCEPTION 'Engine rules must be seeded first';
  END IF;
  IF EXISTS (SELECT 1 FROM documentation_examples WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) THEN
    RAISE EXCEPTION 'Documentation examples already exist for DRAFT';
  END IF;
END;
$$;

INSERT INTO documentation_examples (
  id, config_version_id, stable_id, input_summary, expected_module_summary,
  primary_focus, steps_summary, recommendations_summary, sort_order, active
) VALUES
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E01', 'Ещё не искал; не понимаю, куда двигаться; не хватает опыта; хочу выбрать направление', 'M01 → M03 → M04', 'Выбор направления', 'Сравнить роли → выбрать гипотезу → собрать первый доказуемый кейс.', 'Карьерная консультация; Факультетские активности; Сверка с рынком', 1, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E02', 'Активно откликаюсь; сложно найти вакансии; почти нет приглашений; хочу найти работу', 'M02 → M05 → M08', 'Поиск возможностей', 'Расширить каналы → адаптировать резюме → считать конверсию откликов.', 'Дайджесты и подборки; Мероприятия; Трекер поиска', 2, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E03', 'Прохожу отборы; сложно собеседование; сложно тестовое', 'M06 → M07', 'Собеседование', 'Самопрезентация → 6–8 историй → мок-интервью; отдельно — шаблон тестового.', 'Карьерная консультация; Мероприятия; Тренировочное собеседование', 3, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E04', 'Есть актуальное резюме; откликаюсь, но не получаю приглашений', 'M05 → M02', 'Резюме и отклик', 'Не создавать резюме заново: аудит релевантности → адаптация → проверка конверсии по каналам.', '«Резюме от ИТМО»; Мероприятия; Аудит резюме под вакансию', 4, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E05', 'Уже работаю; хочу развиваться; не понимаю, какие навыки усиливать; важна сильная команда', 'M10 → M04', 'Развитие во время учёбы', 'Цель на 6–12 месяцев → проект с большей ответственностью → два приоритетных навыка.', 'Клубы; Факультетские активности; План на семестр', 5, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E06', 'Хочу попробовать предпринимательство; идеи пока нет; важны самостоятельность и развитие; 2–3 часа в неделю', 'M11 → M10', 'Предпринимательство', 'Выбрать 2–3 знакомые проблемные области → провести 5 интервью → выбрать одну гипотезу для теста.', 'Мероприятия; Клубы; Интервью с потенциальными пользователями', 6, TRUE),
  (gen_random_uuid(), 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid, 'E07', 'Есть идея; проверяю спрос; сложно найти первых клиентов; 4–6 часов в неделю', 'M11', 'Предпринимательство', 'Уточнить сегмент → провести тест спроса → получить первые измеримые сигналы и решить, что менять.', 'Мероприятия; Минимальный тест спроса; Черновик бизнес-модели', 7, TRUE);

DO $$
BEGIN
  IF (SELECT count(*) FROM documentation_examples WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 7
     OR (SELECT count(DISTINCT stable_id) FROM documentation_examples WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid) <> 7 THEN
    RAISE EXCEPTION 'Documentation example seed validation failed';
  END IF;
END;
$$;

COMMIT;

SELECT count(*) AS documentation_examples
FROM documentation_examples
WHERE config_version_id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid;
