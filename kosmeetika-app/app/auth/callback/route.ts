import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/data/auth";

export const dynamic = "force-dynamic";

/**
 * GET /auth/callback?code=...&next=/...
 * Supabase'i kinnituskirja link suunab siia; vahetame koodi sessiooni vastu.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
      // Tavaline põhjus: link avati teises seadmes/brauseris (PKCE verifier puudub)
      // või aadress pole Supabase'i Redirect URLs nimekirjas.
      console.error("[backend] auth callback:", error.code ?? error.message);
    } catch (err) {
      console.error("[backend] auth callback:", (err as Error).message);
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=1", origin));
}
