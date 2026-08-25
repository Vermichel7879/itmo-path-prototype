import "./load-project-environment";

import { sql } from "drizzle-orm";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";

interface Phase4SchemaState extends Record<string, unknown> {
  adminLoginAttemptsExists: boolean;
  drizzleMigrationRecords: number;
  opportunitiesCount: number;
  opportunitiesVersionColumnExists: boolean;
  opportunitiesVersionColumnNotNull: boolean;
  opportunitiesVersionForeignKeyExists: boolean;
  opportunitiesVersionStableIndexExists: boolean;
  publishedSnapshotReaderExists: boolean;
}

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
    const rows = await connection.db.execute<Phase4SchemaState>(sql`
      select
        to_regclass('public.admin_login_attempts') is not null
          as "adminLoginAttemptsExists",
        coalesce(
          (select count(*)::int from drizzle.__drizzle_migrations),
          0
        ) as "drizzleMigrationRecords",
        (select count(*)::int from opportunities) as "opportunitiesCount",
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'opportunities'
            and column_name = 'config_version_id'
        ) as "opportunitiesVersionColumnExists",
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'opportunities'
            and column_name = 'config_version_id'
            and is_nullable = 'NO'
        ) as "opportunitiesVersionColumnNotNull",
        exists (
          select 1
          from information_schema.table_constraints
          where table_schema = 'public'
            and table_name = 'opportunities'
            and constraint_name = 'opportunities_config_version_id_config_versions_id_fk'
            and constraint_type = 'FOREIGN KEY'
        ) as "opportunitiesVersionForeignKeyExists",
        to_regclass('public.opportunities_version_stable_unique') is not null
          as "opportunitiesVersionStableIndexExists",
        to_regprocedure(
          'public.read_published_config_snapshot_chunk(uuid,integer,integer)'
        ) is not null as "publishedSnapshotReaderExists"
    `);
    const state = rows[0];
    if (!state) throw new Error("PHASE4_SCHEMA_VERIFY_EMPTY_RESULT");

    console.log(`ADMIN_LOGIN_ATTEMPTS_EXISTS=${state.adminLoginAttemptsExists}`);
    console.log(`OPPORTUNITIES_COUNT=${state.opportunitiesCount}`);
    console.log(
      `OPPORTUNITIES_VERSION_COLUMN_EXISTS=${state.opportunitiesVersionColumnExists}`,
    );
    console.log(
      `OPPORTUNITIES_VERSION_COLUMN_NOT_NULL=${state.opportunitiesVersionColumnNotNull}`,
    );
    console.log(
      `OPPORTUNITIES_VERSION_FK_EXISTS=${state.opportunitiesVersionForeignKeyExists}`,
    );
    console.log(
      `OPPORTUNITIES_VERSION_STABLE_INDEX_EXISTS=${state.opportunitiesVersionStableIndexExists}`,
    );
    console.log(
      `PUBLISHED_SNAPSHOT_READER_EXISTS=${state.publishedSnapshotReaderExists}`,
    );
    console.log(`DRIZZLE_MIGRATION_RECORDS=${state.drizzleMigrationRecords}`);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    `PHASE4_SCHEMA_VERIFY=FAILED reason=${error instanceof Error ? error.name : "UNKNOWN"}`,
  );
  process.exitCode = 1;
});
