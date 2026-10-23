/* eslint-disable @typescript-eslint/no-explicit-any -- raw Admin API JSON; operations are schema-checked by `npm run graphql-codegen` */
/**
 * Thin wrapper around the Admin GraphQL client that throws readable errors.
 * Both top-level `errors` and mutation `userErrors` are surfaced — swallowing them only
 * produces "cannot read properties of null" crashes later.
 */
export type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/**
 * Follow-up work after a delete (re-sending the discounts to the store). The delete itself already
 * happened, so a failure here must not look like the delete failed: it is reported as "warn".
 */
export async function afterDelete(work: () => Promise<unknown>): Promise<"ok" | "warn"> {
  try {
    await work();
    return "ok";
  } catch (e) {
    console.error("Follow-up after delete failed:", e);
    return "warn";
  }
}

export class AdminError extends Error {}

/** Shopify's THROTTLED answer (too many calls for the store's API budget): tried again after a short wait, at most 2 times. */
export const GQL_RETRY = { times: 2, waitMs: 1000 };
const throttled = (v: unknown) => /THROTTLED|Throttled/.test(v instanceof Error ? v.message : JSON.stringify(v ?? ""));

export async function gql<T = any>(
  admin: AdminClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let json: any;
  for (let attempt = 0; ; attempt++) {
    let thrown: unknown = null;
    try {
      json = await (await admin.graphql(query, { variables })).json();
    } catch (e) {
      thrown = e;
    }
    const busy = thrown ? throttled(thrown) : (json?.errors ?? []).some((e: any) => e?.extensions?.code === "THROTTLED");
    if (!busy || attempt >= GQL_RETRY.times) {
      if (thrown) throw thrown;
      break;
    }
    // 1 second, then 2: Shopify refills the budget every second.
    await new Promise((r) => setTimeout(r, GQL_RETRY.waitMs * (attempt + 1)));
  }
  if (json.errors?.length) {
    throw new AdminError(json.errors.map((e: any) => e.message).join("; "));
  }
  const data = json.data ?? {};
  for (const value of Object.values<any>(data)) {
    const userErrors = value?.userErrors;
    if (Array.isArray(userErrors) && userErrors.length) {
      throw new AdminError(
        userErrors
          .map((e: any) => (e.field ? `${[].concat(e.field).join(".")}: ` : "") + e.message)
          .join("; "),
      );
    }
  }
  return data as T;
}

export function numericId(gid: string): string {
  return String(gid).split("/").pop() || "";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
