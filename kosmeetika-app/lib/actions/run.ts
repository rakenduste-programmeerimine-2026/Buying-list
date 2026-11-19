import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authUnavailable, isTransientAuthError, mapUnexpected } from "@/lib/data/errors";
import { failure } from "@/lib/data/result";
import type { ActionResult } from "@/lib/data/result";
import type { DbClient } from "@/lib/data/types";

export const NOT_SIGNED_IN = "Sa ei ole sisse logitud. Laadi leht uuesti.";

/**
 * Loob päringu jaoks Supabase'i serverikliendi, kontrollib et kasutaja on
 * sisse logitud (ka anonüümne kasutaja sobib) ja käivitab andmefunktsiooni.
 *
 * Sisselogimise kontroll on lisakaitse: RLS peidaks andmed niikuinii, aga
 * siis saaks kasutaja segase „ei leitud“ vea. Nii saab ta selge 401.
 */
export async function withDb<T>(
  context: string,
  fn: (db: DbClient) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let db: DbClient;
  try {
    db = await createClient();
  } catch (err) {
    return mapUnexpected(err, context);
  }

  try {
    // getClaims() kontrollib JWT allkirja (getSession() EI kontrolli, seda ei tohi
    // serveris usaldada). Asümmeetriliste võtmete korral ilma võrgupäringuta.
    const { data, error } = await db.auth.getClaims();
    if (error && isTransientAuthError(error)) return authUnavailable(context, error);
    if (error || !data?.claims.sub) return failure("UNAUTHORIZED", NOT_SIGNED_IN);
  } catch (err) {
    return mapUnexpected(err, context);
  }

  return fn(db);
}

/** Värskendab Next.js vahemälu pärast edukat muudatust. */
export function revalidateStores(storeId?: string) {
  revalidatePath("/");
  if (storeId) revalidatePath(`/stores/${storeId}`);
}
