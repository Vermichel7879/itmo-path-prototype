export type RelationUpdateRequest = {
  entityType: "MAPPING_UPDATE" | "MODULE_RECOMMENDATION_UPDATE";
  stableId: string;
  expectedUpdatedAt: string;
  valueName: "weight" | "priority";
  value: number;
};

type FetchResponse = {
  ok: boolean;
  json: () => Promise<{ error?: string }>;
};

type FetchRelationUpdate = (
  input: string,
  init: RequestInit,
) => Promise<FetchResponse>;

export async function patchRelationUpdate(
  request: RelationUpdateRequest,
  fetchUpdate: FetchRelationUpdate = fetch,
) {
  const response = await fetchUpdate("/api/admin/draft", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      entityType: request.entityType,
      stableId: request.stableId,
      expectedUpdatedAt: request.expectedUpdatedAt,
      values: { [request.valueName]: request.value },
    }),
  });

  return {
    ok: response.ok,
    result: await response.json(),
  };
}
