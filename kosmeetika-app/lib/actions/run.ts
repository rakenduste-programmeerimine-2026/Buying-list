import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapUnexpected } from "@/lib/data/errors";
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
    db = (await createClient()) as unknown as DbClient;
  } catch (err) {
    return mapUnexpected(err, context);
  }

  try {
    // getUser() kontrollib tokenit Supabase'i Auth serveris (getSession() ei kontrolli).
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", NOT_SIGNED_IN);
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
