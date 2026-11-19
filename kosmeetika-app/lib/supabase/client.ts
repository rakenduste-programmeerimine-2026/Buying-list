import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Supabase'i klient brauseris (Client Components).
 *
 * Kasutab ainult avalikku (publishable/anon) võtit, seega kõik päringud lähevad läbi
 * Row Level Security reeglite. `createBrowserClient` hoiab ühte eksemplari,
 * nii et funktsiooni võib kutsuda mitu korda.
 */
export function createClient() {
  const { url, publicKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publicKey);
}
