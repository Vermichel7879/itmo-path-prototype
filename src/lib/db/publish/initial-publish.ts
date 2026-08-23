import { max, sql } from "drizzle-orm";

import type { CareerDatabase } from "../connection";
import { configVersions } from "../schema";
import { validateInitialPublishSnapshot } from "./publish-validation";

type DraftRow = {
  id: string;
  label: string | null;
  sourceFileName: string | null;
  sourceSha256: string | null;
  snapshot: unknown;
};

export type InitialPublishResult = {
  status: "PUBLISHED" | "ALREADY_PUBLISHED";
  publishedConfigId: string;
  draftConfigId: string;
};

export async function publishInitialCareerConfig(
  db: CareerDatabase,
): Promise<InitialPublishResult> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('career-trajectory-initial-publish'))`,
    );

    const publishedRows = await transaction.execute<{ id: string }>(sql`
      select id::text as id
      from config_versions
      where status = 'PUBLISHED'
      order by published_at desc, version_number desc
    `);
    const draftRows = await transaction.execute<DraftRow>(sql`
      select id::text as id, label, source_file_name as "sourceFileName",
             source_sha256 as "sourceSha256", snapshot
      from config_versions
      where status = 'DRAFT'
      for update
    `);

    if (draftRows.length !== 1) {
      throw new Error("INITIAL_PUBLISH_FAILED reason=EXPECTED_ONE_DRAFT");
    }
    const draft = draftRows[0];

    if (publishedRows.length > 0) {
      if (publishedRows.length !== 1) {
        throw new Error("INITIAL_PUBLISH_FAILED reason=MULTIPLE_PUBLISHED_CONFIGS");
      }
      return {
        status: "ALREADY_PUBLISHED",
        publishedConfigId: publishedRows[0].id,
        draftConfigId: draft.id,
      };
    }

    const snapshot = validateInitialPublishSnapshot(draft.snapshot);
    const [latestVersion] = await transaction
      .select({ value: max(configVersions.versionNumber) })
      .from(configVersions);
    const [published] = await transaction
      .insert(configVersions)
      .values({
        versionNumber: (latestVersion?.value ?? 0) + 1,
        status: "PUBLISHED",
        label: `Initial publish: ${draft.label ?? "career configuration"}`,
        sourceFileName: draft.sourceFileName,
        sourceSha256: draft.sourceSha256,
        snapshot,
        publishedAt: new Date(),
      })
      .returning({ id: configVersions.id });

    if (!published) throw new Error("INITIAL_PUBLISH_FAILED reason=INSERT_FAILED");
    return {
      status: "PUBLISHED",
      publishedConfigId: published.id,
      draftConfigId: draft.id,
    };
  });
}
