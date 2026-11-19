"use server";

/**
 * Sisselogimise Server Actions (Supabase Auth, e-post + parool).
 *
 * Vaikimisi luuakse igale seadmele anonüümne kasutaja (vt middleware.ts),
 * nii et rakendus töötab ka ilma sisselogimise vormita. Need funktsioonid on
 * valmis, kui frontend tahab lisada konto loomise / sisselogimise.
 *
 * NB: kui anonüümne kasutaja logib sisse TEISE kontoga, jäävad tema senised
 * andmed anonüümse kasutaja juurde. Andmete säilitamiseks kasuta upgradeAnonymousUser.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as auth from "@/lib/data/auth";
import { mapUnexpected } from "@/lib/data/errors";
import type { ActionResult, Failure } from "@/lib/data/result";
import type { DbClient } from "@/lib/data/types";

async function db(context: string): Promise<{ ok: true; db: DbClient } | Failure> {
  try {
    return { ok: true, db: (await createClient()) as unknown as DbClient };
  } catch (err) {
    return mapUnexpected(err, context);
  }
}

/**
 * Kinnituskirja lingi sihtkoht: NEXT_PUBLIC_SITE_URL + /auth/callback.
 * Host-päist ei kasutata, sest ründaja saab seda ise määrata (host header injection).
 * Kui muutujat pole, kasutab Supabase oma „Site URL“ seadet.
 * Lisa see aadress ka Supabase → Authentication → URL Configuration → Redirect URLs.
 */
function callbackUrl(): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return undefined;
  try {
    return new URL("/auth/callback", site).toString();
  } catch {
    return undefined;
  }
}

export async function getCurrentUser(): Promise<ActionResult<auth.CurrentUser | null>> {
  const c = await db("getCurrentUser");
  if (!c.ok) return c;
  return auth.getCurrentUser(c.db);
}

export async function signUp(email: string, password: string): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const c = await db("signUp");
  if (!c.ok) return c;
  return auth.signUp(c.db, email, password, callbackUrl());
}

export async function signIn(email: string, password: string): Promise<ActionResult<auth.CurrentUser>> {
  const c = await db("signIn");
  if (!c.ok) return c;
  const r = await auth.signIn(c.db, email, password);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function signOut(): Promise<ActionResult<null>> {
  const c = await db("signOut");
  if (!c.ok) return c;
  const r = await auth.signOut(c.db);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function upgradeAnonymousUser(email: string): Promise<ActionResult<{ confirmationSent: true }>> {
  const c = await db("upgradeAnonymousUser");
  if (!c.ok) return c;
  return auth.upgradeAnonymousUser(c.db, email, callbackUrl());
}

export async function setPassword(password: string): Promise<ActionResult<null>> {
  const c = await db("setPassword");
  if (!c.ok) return c;
  return auth.setPassword(c.db, password);
}
