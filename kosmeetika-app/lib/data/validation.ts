import { failure, type Failure } from "./result";

export type Valid<T> = { ok: true; value: T };

/** Nime maksimaalne pikkus (tähemärkides) poe ja toote jaoks. */
export const MAX_NAME_LENGTH = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Juhtmärgid (reavahetused, tabulaatorid, NUL jne) ei kuulu nimesse.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/;

export type NameKind = "store" | "product";

const LABELS: Record<NameKind, { empty: string; tooLong: string; invalid: string }> = {
  store: {
    empty: "Poe nimi ei tohi olla tühi.",
    tooLong: `Poe nimi võib olla kuni ${MAX_NAME_LENGTH} tähemärki pikk.`,
    invalid: "Poe nimi sisaldab lubamatuid märke.",
  },
  product: {
    empty: "Toote nimi ei tohi olla tühi.",
    tooLong: `Toote nimi võib olla kuni ${MAX_NAME_LENGTH} tähemärki pikk.`,
    invalid: "Toote nimi sisaldab lubamatuid märke.",
  },
};

/**
 * Kontrollib ja puhastab nime: eemaldab algus- ja lõputühikud,
 * keelab tühja nime, liiga pika nime ja juhtmärgid.
 */
export function validateName(
  value: unknown,
  kind: NameKind,
): Valid<string> | Failure {
  const labels = LABELS[kind];
  if (typeof value !== "string") return failure("VALIDATION", labels.empty);

  const name = value.normalize("NFC").trim();
  if (name.length === 0) return failure("VALIDATION", labels.empty);
  if (CONTROL_CHARS_RE.test(name)) return failure("VALIDATION", labels.invalid);
  // Array.from loeb emojid jms ühe märgina, mitte kahe UTF-16 ühikuna.
  if (Array.from(name).length > MAX_NAME_LENGTH) return failure("VALIDATION", labels.tooLong);

  return { ok: true, value: name };
}

/** Kas väärtus on korrektne UUID? */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function validateId(
  value: unknown,
  kind: NameKind,
): Valid<string> | Failure {
  if (!isUuid(value)) {
    return failure("VALIDATION", kind === "store" ? "Vigane poe ID." : "Vigane toote ID.");
  }
  return { ok: true, value: value.toLowerCase() };
}

export function validateBoolean(
  value: unknown,
): Valid<boolean> | Failure {
  if (typeof value !== "boolean") {
    return failure("VALIDATION", "„Vaja juurde“ väärtus peab olema tõene või väär.");
  }
  return { ok: true, value };
}
