import type { DbClient } from "@/lib/data/types";

export type Response = { data?: unknown; error?: unknown };
export type Call = { table: string; chain: Array<[string, unknown[]]> };

/**
 * Väike Supabase'i kliendi asendus testide jaoks.
 *
 * - `respond(...)` lisab järjekorda vastused (üks iga `from()` päringu kohta).
 * - `calls` salvestab, milliseid meetodeid mis argumentidega kutsuti,
 *   et saaks kontrollida filtreid, sorteerimist ja sisestatud andmeid.
 * - `throwOnNext()` simuleerib võrguviga.
 */
export function createFakeSupabase() {
  const queue: Array<Response | Error> = [];
  const calls: Call[] = [];

  const auth = {
    user: { id: "44444444-4444-4444-8444-444444444444", is_anonymous: true } as Record<string, unknown> | null,
    getUser: async () =>
      auth.user
        ? { data: { user: auth.user }, error: null }
        : { data: { user: null }, error: { name: "AuthSessionMissingError", message: "Auth session missing!" } },
    getClaims: async () =>
      auth.user
        ? { data: { claims: { sub: auth.user.id, role: "authenticated", is_anonymous: auth.user.is_anonymous } }, error: null }
        : { data: null, error: null },
  };

  const client = {
    auth,
    from(table: string) {
      const call: Call = { table, chain: [] };
      calls.push(call);
      const next = queue.shift() ?? { data: null, error: null };

      const builder: Record<string, unknown> = {};
      for (const method of [
        "select",
        "insert",
        "update",
        "delete",
        "eq",
        "order",
        "single",
        "maybeSingle",
      ]) {
        builder[method] = (...args: unknown[]) => {
          call.chain.push([method, args]);
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        if (next instanceof Error) return Promise.reject(next).then(resolve, reject);
        return Promise.resolve({ data: next.data ?? null, error: next.error ?? null }).then(resolve, reject);
      };
      return builder;
    },
  };

  return {
    db: client as unknown as DbClient,
    auth,
    /** Simuleerib väljalogitud kasutajat. */
    signOut() {
      auth.user = null;
    },
    calls,
    respond(...responses: Response[]) {
      queue.push(...responses);
    },
    throwOnNext(message = "fetch failed") {
      queue.push(new Error(message));
    },
    /** Kõik antud meetodi kutsete argumendid viimases (või n-ndas) päringus. */
    argsOf(method: string, callIndex = calls.length - 1) {
      return calls[callIndex]?.chain.filter(([m]) => m === method).map(([, a]) => a) ?? [];
    },
    methodsOf(callIndex = calls.length - 1) {
      return calls[callIndex]?.chain.map(([m]) => m) ?? [];
    },
  };
}

export const STORE_ID = "11111111-1111-4111-8111-111111111111";
export const STORE_ID_2 = "22222222-2222-4222-8222-222222222222";
export const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
export const NOW = "2026-11-19T10:00:00.000Z";

export const store = (over: Partial<{ id: string; name: string; created_at: string }> = {}) => ({
  id: STORE_ID,
  name: "Kosmeetikahulgi OÜ",
  created_at: NOW,
  ...over,
});

export const product = (
  over: Partial<{ id: string; store_id: string; name: string; is_needed: boolean; created_at: string }> = {},
) => ({
  id: PRODUCT_ID,
  store_id: STORE_ID,
  name: "Vatipadjad",
  is_needed: false,
  created_at: NOW,
  ...over,
});
