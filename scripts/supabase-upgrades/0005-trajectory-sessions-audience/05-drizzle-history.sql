BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 5 THEN
    RAISE EXCEPTION 'Expected exactly five existing Drizzle migration records';
  END IF;
  IF (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('trajectory_sessions','session_answers','session_module_scores','session_score_contributions','session_module_results','session_recommendations')) <> 6
     OR to_regprocedure('public.public_complete_trajectory_session(uuid,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Trajectory sessions upgrade is incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash='6b828e3c1fc4b98810916ee2d20d6527c9cf2f358937905ed70ad81f35bc119b' OR created_at=1787822638754) THEN
    RAISE EXCEPTION 'Migration 0005 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('6b828e3c1fc4b98810916ee2d20d6527c9cf2f358937905ed70ad81f35bc119b', 1787822638754);

COMMIT;

SELECT count(*) AS drizzle_migration_records FROM drizzle.__drizzle_migrations;
