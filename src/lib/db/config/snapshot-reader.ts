import { sql } from "drizzle-orm";

import type { CareerDatabaseExecutor } from "../connection";

const CHUNK_SIZE = 2048;
const MAX_SNAPSHOT_CHARS = 2_000_000;

interface SnapshotChunkRow extends Record<string, unknown> {
  chunkText: string;
  totalChars: number;
}

async function assembleChunks(
  first: SnapshotChunkRow | undefined,
  read: (offset: number) => Promise<SnapshotChunkRow | undefined>,
) {
  if (!first) return null;
  const total = Number(first.totalChars);
  if (!Number.isSafeInteger(total) || total < 2 || total > MAX_SNAPSHOT_CHARS) {
    throw new Error("CONFIG_SNAPSHOT_INVALID_LENGTH");
  }
  const chunks = [first.chunkText];
  for (let offset = CHUNK_SIZE; offset < total; offset += CHUNK_SIZE) {
    const next = await read(offset);
    if (!next || Number(next.totalChars) !== total) {
      throw new Error("CONFIG_SNAPSHOT_CHANGED_DURING_READ");
    }
    chunks.push(next.chunkText);
  }
  return JSON.parse(chunks.join("")) as unknown;
}

export async function readPublishedSnapshotChunks(
  db: CareerDatabaseExecutor,
  configVersionId: string,
) {
  const read = async (offset: number) => {
    const rows = await db.execute<SnapshotChunkRow>(sql`
      select
        chunk_text as "chunkText",
        total_chars as "totalChars"
      from read_published_config_snapshot_chunk(
        ${configVersionId}::uuid,
        ${offset}::integer,
        ${CHUNK_SIZE}::integer
      )
    `);
    return rows[0];
  };
  return assembleChunks(await read(0), read);
}

export async function readDraftSnapshotChunks(
  db: CareerDatabaseExecutor,
  configVersionId: string,
) {
  const read = async (offset: number) => {
    const rows = await db.execute<SnapshotChunkRow>(sql`
      select
        substring(snapshot::text from ${offset + 1} for ${CHUNK_SIZE}) as "chunkText",
        char_length(snapshot::text)::integer as "totalChars"
      from config_versions
      where id = ${configVersionId}::uuid and status = 'DRAFT'
    `);
    return rows[0];
  };
  return assembleChunks(await read(0), read);
}
