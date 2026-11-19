import { z } from "zod";
import { failure, success, type ActionResult, type Failure } from "./result";
import type { DbClient } from "./types";
import { parseWith, type Valid } from "./validation";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt'i piir baitides

export type CurrentUser = { id: string; email: string | null; isAnonymous: boolean };

export const emailSchema = z
  .string({ error: "Sisesta e-posti aadress." })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, { error: "Sisesta e-posti aadress." })
      .max(254, { error: "E-posti aadress ei ole korrektne." })
      .pipe(z.email({ error: "E-posti aadress ei ole korrektne." })),
  );

export const passwordSchema = z
  .string({ error: `Parool peab olema vähemalt ${MIN_PASSWORD_LENGTH} tähemärki pikk.` })
  .min(MIN_PASSWORD_LENGTH, { error: `Parool peab olema vähemalt ${MIN_PASSWORD_LENGTH} tähemärki pikk.` })
  .refine((v) => new TextEncoder().encode(v).length <= MAX_PASSWORD_LENGTH, {
    error: `Parool võib olla kuni ${MAX_PASSWORD_LENGTH} baiti pikk.`,
  });

type AuthErrorLike = { code?: string | null; status?: number | null; message?: string | null; name?: string };

export function validateEmail(value: unknown): Valid<string> | Failure {
  return parseWith(emailSchema, value);
}

export function validatePassword(value: unknown): Valid<string> | Failure {
  return parseWith(passwordSchema, value);
}

/** Supabase Auth'i vea teisendamine. Ei avalda, kas e-post on süsteemis (v.a registreerimisel). */
export function mapAuthError(error: AuthErrorLike, context: string): Failure {
  switch (error.code) {
    case "invalid_credentials":
      return failure("UNAUTHORIZED", "Vale e-post või parool.");
    case "email_not_confirmed":
      return failure("UNAUTHORIZED", "Kinnita oma e-posti aadress (vaata postkasti).");
    case "user_already_exists":
    case "email_exists":
      return failure("CONFLICT", "Selle e-postiga konto on juba olemas.");
    case "weak_password":
      return failure("VALIDATION", "Parool on liiga nõrk. Vali pikem või keerulisem parool.");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return failure("FORBIDDEN", "Liiga palju katseid. Proovi mõne minuti pärast uuesti.");
    case "anonymous_provider_disabled":
      return failure("CONFIG", "Anonüümne sisselogimine on Supabase'is välja lülitatud.");
    case "signup_disabled":
      return failure("FORBIDDEN", "Uute kontode loomine on välja lülitatud.");
    case "session_not_found":
    case "user_not_found":
      return failure("UNAUTHORIZED", "Sa ei ole sisse logitud.");
    default:
      if (process.env.NODE_ENV !== "test") console.error(`[backend] ${context}:`, error.code, error.message);
      return failure("UNKNOWN", "Sisselogimine ebaõnnestus. Proovi hiljem uuesti.");
  }
}

async function guard<T>(context: string, fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.error(`[backend] ${context}:`, (err as Error).message);
    return failure("UNKNOWN", "Sisselogimise teenusega ei saanud ühendust. Proovi hiljem uuesti.");
  }
}

/** Praegune kasutaja või null (ei ole viga, kui keegi pole sisse logitud). */
export async function getCurrentUser(db: DbClient): Promise<ActionResult<CurrentUser | null>> {
  return guard("getCurrentUser", async () => {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return success(null);
    const u = data.user;
    return success({ id: u.id, email: u.email ?? null, isAnonymous: u.is_anonymous ?? false });
  });
}

export async function signUp(
  db: DbClient,
  email: unknown,
  password: unknown,
  emailRedirectTo?: string,
): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const e = validateEmail(email);
  if (!e.ok) return e;
  const p = validatePassword(password);
  if (!p.ok) return p;
  return guard("signUp", async () => {
    const { data, error } = await db.auth.signUp({
      email: e.value,
      password: p.value,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    if (error) return mapAuthError(error, "signUp");
    return success({ needsEmailConfirmation: !data.session });
  });
}

export async function signIn(db: DbClient, email: unknown, password: unknown): Promise<ActionResult<CurrentUser>> {
  const e = validateEmail(email);
  if (!e.ok) return e;
  // Sisselogimisel ei kontrolli parooli pikkust, et mitte avaldada reegleid; ainult tüüpi.
  if (typeof password !== "string" || password.length === 0) return failure("VALIDATION", "Sisesta parool.");
  return guard("signIn", async () => {
    const { data, error } = await db.auth.signInWithPassword({ email: e.value, password });
    if (error) return mapAuthError(error, "signIn");
    return success({ id: data.user.id, email: data.user.email ?? null, isAnonymous: false });
  });
}

export async function signOut(db: DbClient): Promise<ActionResult<null>> {
  return guard("signOut", async () => {
    const { error } = await db.auth.signOut();
    if (error) return mapAuthError(error, "signOut");
    return success(null);
  });
}

/**
 * Seob anonüümse kasutaja e-postiga, nii et tema poed ja tooted jäävad alles
 * ja ta saab hiljem samale kontole teisest seadmest sisse logida.
 * Supabase saadab kinnituskirja; parool määratakse pärast kinnitamist (setPassword).
 */
export async function upgradeAnonymousUser(
  db: DbClient,
  email: unknown,
  emailRedirectTo?: string,
): Promise<ActionResult<{ confirmationSent: true }>> {
  const e = validateEmail(email);
  if (!e.ok) return e;
  return guard("upgradeAnonymousUser", async () => {
    const current = await db.auth.getUser();
    if (current.error || !current.data.user) return failure("UNAUTHORIZED", "Sa ei ole sisse logitud.");
    if (!current.data.user.is_anonymous) return failure("CONFLICT", "Konto on juba e-postiga seotud.");
    const { error } = await db.auth.updateUser({ email: e.value }, emailRedirectTo ? { emailRedirectTo } : undefined);
    if (error) return mapAuthError(error, "upgradeAnonymousUser");
    return success({ confirmationSent: true as const });
  });
}

/** Parooli määramine või muutmine sisse logitud (mitte-anonüümsele) kasutajale. */
export async function setPassword(db: DbClient, password: unknown): Promise<ActionResult<null>> {
  const p = validatePassword(password);
  if (!p.ok) return p;
  return guard("setPassword", async () => {
    const current = await db.auth.getUser();
    if (current.error || !current.data.user) return failure("UNAUTHORIZED", "Sa ei ole sisse logitud.");
    if (current.data.user.is_anonymous) return failure("VALIDATION", "Seo enne konto e-postiga.");
    const { error } = await db.auth.updateUser({ password: p.value });
    if (error) return mapAuthError(error, "setPassword");
    return success(null);
  });
}

/**
 * Turvaline suunamise sihtkoht: ainult sama saidi suhteline tee.
 * Takistab „open redirect“ rünnakut (nt ?next=https://evil.example või //evil.example).
 */
export function safeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F]/.test(next)) return fallback;
  return next;
}
