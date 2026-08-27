SELECT
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records,
  EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = '5ec09f57cb23ae10ee87d85be997257e65ec1b1582c0c8d6916d554a4d854498'
      AND created_at = 1787851250484
  ) AS migration_0007_registered,
  NOT EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = 'b46842f7fc171c909841f69cdaec213656e8bcd255c7862a8bbdc730745720c1'
       OR created_at = 1787856437820
  ) AS migration_0008_not_registered,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED') AS published_configs;
