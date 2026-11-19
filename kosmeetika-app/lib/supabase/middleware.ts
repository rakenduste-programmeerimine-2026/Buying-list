import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Kas sellele päringule võib luua anonüümse sessiooni?
 *
 * Ainult tavaline lehe avamine (GET + HTML). API-päringud ja muud meetodid
 * anonüümset kasutajat ei loo, et keegi ei saaks skriptiga tuhandeid
 * kasutajaid tekitada. Frontend avab alati enne lehe, seega küpsis on olemas.
 */
export function shouldCreateAnonymousSession(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") || path.startsWith("/auth/")) return false;
  // Next.js eellaadimine (prefetch) ei tohi kasutajat luua.
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return false;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

/**
 * Värskendab Supabase'i sessiooni küpsiseid igal päringul.
 *
 * Kui kasutajal sessiooni pole, luuakse anonüümne kasutaja
 * (Supabase Auth → Anonymous sign-ins peab olema sisse lülitatud).
 * Nii saab iga seade oma privaatse ostunimekirja, ilma et frontendis oleks
 * sisselogimise vormi. Hiljem saab anonüümse kasutaja siduda e-postiga
 * (vt lib/actions/auth.ts → upgradeAnonymousUser), andmed jäävad alles.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  let env: { url: string; publicKey: string };
  try {
    env = getSupabaseEnv();
  } catch {
    // Seadistus puudub: lase päring läbi, API tagastab selge veateate.
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Sessiooniküpsistega vastust ei tohi CDN vahemällu panna.
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // NB: createServerClient ja getClaims() vahele ei tohi muud koodi panna.
  // getClaims() kontrollib JWT allkirja (asümmeetriliste võtmete korral lokaalselt,
  // ilma võrgupäringuta) ja vajadusel värskendab sessiooni.
  try {
    const { data } = await supabase.auth.getClaims();
    const hasUser = Boolean(data?.claims?.sub);

    if (!hasUser && shouldCreateAnonymousSession(request)) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) console.error("[backend] anonüümne sisselogimine ebaõnnestus:", error.code ?? error.message);
    }
  } catch (err) {
    console.error("[backend] sessiooni värskendamine ebaõnnestus:", (err as Error).message);
  }

  return response;
}
