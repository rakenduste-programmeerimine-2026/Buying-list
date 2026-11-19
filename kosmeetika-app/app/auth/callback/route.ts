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
    } catch {
      // langeb allpool veasuunamisele
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=1", origin));
}
