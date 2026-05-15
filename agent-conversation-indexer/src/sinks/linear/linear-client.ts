import type { IndexerConfig } from "../../config";

const LINEAR = "https://api.linear.app/graphql";

type GraphResponse<T> = { data?: T; errors?: { message: string }[] };

export async function linearGraphql<V>(opts: {
  cfg: Pick<IndexerConfig, "linearApiKey">;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<V> {
  const res = await fetch(LINEAR, {
    method: "POST",
    headers: {
      /** Linear expects the raw key, not `Bearer`. */
      Authorization: opts.cfg.linearApiKey ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: opts.query, variables: opts.variables ?? {} }),
  });
  const raw = await res.json();
  if (!res.ok) throw new Error(`Linear HTTP ${res.status}`);
  const j = raw as GraphResponse<V>;
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join("; "));
  if (!j.data) throw new Error("Linear returned no data");
  return j.data;
}
