/**
 * Supabase'i keskkonnamuutujad.
 *
 * NB: `process.env.NEXT_PUBLIC_*` tuleb kirjutada otse välja, sest Next.js
 * asendab need build'i ajal ainult staatilise kuju korral.
 */
export function getSupabaseEnv(): { url: string; publicKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Uus Supabase'i võti on „publishable key“ (sb_publishable_...). Vana „anon“ võti
  // töötab samamoodi; README kasutab nime NEXT_PUBLIC_SUPABASE_ANON_KEY.
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publicKey) {
    throw new Error(
      "Supabase'i seadistus puudub: lisa .env.local faili NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY (või NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), vt .env.example.",
    );
  }
  if (publicKey.startsWith("sb_secret_")) {
    throw new Error("NEXT_PUBLIC_ muutujas on salajane (sb_secret_) võti! Kasuta publishable/anon võtit.");
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

  return { url, publicKey };
}
