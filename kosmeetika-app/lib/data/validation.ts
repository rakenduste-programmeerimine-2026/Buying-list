import { z } from "zod";
import { failure, type Failure } from "./result";

/**
 * Sisendi valideerimine (Zod skeemid).
 *
 * Skeemid on eksporditud, et frontend saaks soovi korral kasutada täpselt samu
 * reegleid (nt vormi kontrolliks). Backend valideerib alati uuesti.
 */

/** Nime maksimaalne pikkus (tähemärkides) poe ja toote jaoks. */
export const MAX_NAME_LENGTH = 100;

export type Valid<T> = { ok: true; value: T };
export type NameKind = "store" | "product";

// Juhtmärgid (reavahetused, tabulaatorid, NUL jne) ei kuulu nimesse.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/;

const MESSAGES = {
  store: {
    empty: "Poe nimi ei tohi olla tühi.",
    tooLong: `Poe nimi võib olla kuni ${MAX_NAME_LENGTH} tähemärki pikk.`,
    invalid: "Poe nimi sisaldab lubamatuid märke.",
    id: "Vigane poe ID.",
  },
  product: {
    empty: "Toote nimi ei tohi olla tühi.",
    tooLong: `Toote nimi võib olla kuni ${MAX_NAME_LENGTH} tähemärki pikk.`,
    invalid: "Toote nimi sisaldab lubamatuid märke.",
    id: "Vigane toote ID.",
  },
} as const satisfies Record<NameKind, Record<string, string>>;

function nameSchema(kind: NameKind) {
  const m = MESSAGES[kind];
  return z
    .string({ error: m.empty })
    .transform((value) => value.normalize("NFC").trim())
    .pipe(
      z
        .string()
        .min(1, { error: m.empty })
        .refine((value) => !CONTROL_CHARS_RE.test(value), { error: m.invalid })
        // Array.from loeb emojid jms ühe märgina, mitte kahe UTF-16 ühikuna.
        .refine((value) => Array.from(value).length <= MAX_NAME_LENGTH, { error: m.tooLong }),
    );
}

function idSchema(kind: NameKind) {
  return z.uuid({ error: MESSAGES[kind].id }).transform((id) => id.toLowerCase());
}

export const storeNameSchema = nameSchema("store");
export const productNameSchema = nameSchema("product");
export const storeIdSchema = idSchema("store");
export const productIdSchema = idSchema("product");
export const isNeededSchema = z.boolean({ error: "„Vaja juurde“ väärtus peab olema tõene või väär." });

/** Käivitab skeemi ja teisendab esimese vea `Failure` kujule. */
export function parseWith<T>(schema: z.ZodType<T, unknown>, value: unknown): Valid<T> | Failure {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  return failure("VALIDATION", result.error.issues[0]?.message ?? "Sisestatud andmed ei ole korrektsed.");
}

/**
 * Kontrollib ja puhastab nime: eemaldab algus- ja lõputühikud,
 * keelab tühja nime, liiga pika nime ja juhtmärgid.
 */
export function validateName(value: unknown, kind: NameKind): Valid<string> | Failure {
  return parseWith(kind === "store" ? storeNameSchema : productNameSchema, value);
}

/** Kontrollib, et ID on UUID, ja tagastab selle väiketähtedes. */
export function validateId(value: unknown, kind: NameKind): Valid<string> | Failure {
  return parseWith(kind === "store" ? storeIdSchema : productIdSchema, value);
}

export function validateBoolean(value: unknown): Valid<boolean> | Failure {
  return parseWith(isNeededSchema, value);
}

/** Kas väärtus on korrektne UUID? */
export function isUuid(value: unknown): value is string {
  return storeIdSchema.safeParse(value).success;
}
