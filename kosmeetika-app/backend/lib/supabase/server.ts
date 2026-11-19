import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Supabase'i klient serveris (Server Components, Server Actions, Route Handlers).
 *
 * Loo uus klient iga päringu jaoks, sest see loeb selle päringu küpsiseid.
 * Küpsiste kaudu liigub kasutaja sessioon, kui rakendusse lisatakse Supabase Auth.
 */
export async function createClient() {
  const { url, publicKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Componentis ei saa küpsiseid kirjutada. Seda võib ignoreerida,
          // kui sessiooni värskendab middleware.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
