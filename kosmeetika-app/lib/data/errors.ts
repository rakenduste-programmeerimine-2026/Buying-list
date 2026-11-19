import { failure, type Failure } from "./result";

/** Supabase'i / PostgRESTi vea minimaalne kuju, mida me kasutame. */
export type DbError = { code?: string | null; message?: string | null; details?: string | null };

type Entity = "store" | "product";

const NOT_FOUND: Record<Entity, string> = {
  store: "Poodi ei leitud.",
  product: "Toodet ei leitud.",
};

/** Teade, kui kirjet ei leitud (ka siis, kui RLS selle peidab). */
export function notFound(entity: Entity): Failure {
  return failure("NOT_FOUND", NOT_FOUND[entity]);
}

/**
 * Teisendab andmebaasi vea kasutajale arusaadavaks teateks.
 *
 * Tehnilisi detaile (SQL, tabelinimed, päringud) kasutajale ei näidata,
 * need logitakse ainult serveri poolel.
 */
export function mapDbError(error: DbError, entity: Entity, context: string): Failure {
  switch (error.code) {
    case "PGRST116": // .single() ei leidnud rida
      return notFound(entity);
    case "23503": // foreign key: poodi ei ole olemas
      return failure("NOT_FOUND", NOT_FOUND.store);
    case "23505":
      return failure(
        "CONFLICT",
        entity === "store" ? "Sellise nimega pood on juba olemas." : "Sellise nimega toode on selles poes juba olemas.",
      );
    case "22P02": // vigane UUID vms
    case "23502": // NOT NULL
    case "23514": // CHECK
    case "22001": // liiga pikk väärtus
      return failure("VALIDATION", "Sisestatud andmed ei ole korrektsed.");
    case "42501": // RLS / õigused
    case "PGRST301": // JWT probleem
    case "PGRST302":
      return failure("FORBIDDEN", "Sul pole selle toimingu jaoks õigust.");
    default:
      logServerError(context, error);
      return failure("UNKNOWN", "Midagi läks valesti. Proovi hiljem uuesti.");
  }
}

/** Ootamatu erand (nt võrguühendus katkes). */
export function mapUnexpected(err: unknown, context: string): Failure {
  if (err instanceof Error && err.message.startsWith("Supabase'i seadistus puudub")) {
    logServerError(context, err);
    return failure("CONFIG", "Andmebaasi ühendus ei ole seadistatud.");
  }
  logServerError(context, err);
  return failure("UNKNOWN", "Andmebaasiga ei saanud ühendust. Proovi hiljem uuesti.");
}

function logServerError(context: string, err: unknown) {
  if (process.env.NODE_ENV === "test") return;
  const e = err as DbError | Error;
  console.error(`[backend] ${context}:`, "code" in e ? e.code : undefined, e?.message);
}
