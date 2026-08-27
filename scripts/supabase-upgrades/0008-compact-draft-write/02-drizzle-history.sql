BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id serial PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'b46842f7fc171c909841f69cdaec213656e8bcd255c7862a8bbdc730745720c1'
       OR created_at = 1787856437820
  ) THEN
    RAISE EXCEPTION 'MIGRATION_0008_ALREADY_REGISTERED';
  END IF;

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  VALUES ('b46842f7fc171c909841f69cdaec213656e8bcd255c7862a8bbdc730745720c1', 1787856437820);
END;
$$;

COMMIT;

SELECT count(*)::integer AS migration_0008_records
FROM drizzle.__drizzle_migrations
WHERE hash = 'b46842f7fc171c909841f69cdaec213656e8bcd255c7862a8bbdc730745720c1'
  AND created_at = 1787856437820;
