/**
 * Supabase'i keskkonnamuutujad.
 *
 * NB: `process.env.NEXT_PUBLIC_*` tuleb kirjutada otse välja, sest Next.js
 * asendab need build'i ajal ainult staatilise kuju korral.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase'i seadistus puudub: lisa .env.local faili NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY (vt .env.example).",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ei ole korrektne URL.");
  }
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL peab kasutama https-i.");
  }

  return { url, anonKey };
}
