/**
 * Ühtne tulemuse kuju kõigile andmefunktsioonidele.
 *
 * Funktsioonid ei viska vigu, vaid tagastavad `{ ok: false, error }`, kus
 * `error` on eestikeelne teade, mida frontend võib kasutajale otse näidata.
 * `code` aitab frontendil vajadusel eri olukordi eristada (nt 404 leht).
 */
export type ErrorCode =
  | "VALIDATION" // vigane sisend (tühi nimi, vale ID jne)
  | "NOT_FOUND" // kirjet ei ole (või RLS peidab selle)
  | "CONFLICT" // unikaalsuse rikkumine
  | "UNAUTHORIZED" // kasutaja pole sisse logitud
  | "FORBIDDEN" // RLS keelas toimingu
  | "CONFIG" // Supabase'i seadistus puudub
  | "UNKNOWN"; // muu andmebaasi- või võrguviga

export type Failure = { ok: false; error: string; code: ErrorCode };
export type ActionResult<T> = { ok: true; data: T } | Failure;

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(code: ErrorCode, error: string): Failure {
  return { ok: false, code, error };
}
