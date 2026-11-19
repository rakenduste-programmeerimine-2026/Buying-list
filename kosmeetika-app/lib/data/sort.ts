/**
 * Eesti keele tähestikuline järjestus.
 *
 * Andmebaasi sorteerimine sõltub serveri collation'ist (Supabase'is tavaliselt
 * en_US), mis paneb õ, ä, ö, ü valesse kohta ja arvestab suurtähti. Seetõttu
 * järjestame tulemuse lisaks eesti reeglite järgi:
 *   … s š z ž t u v w õ ä ö ü x y
 * `numeric: true` → „Toode 2“ tuleb enne „Toode 10“.
 */
const collator = new Intl.Collator("et", { sensitivity: "base", numeric: true });

export const compareNames = (a: string, b: string): number => collator.compare(a, b);

type Named = { name: string; created_at: string };

const byNameThenCreated = (a: Named, b: Named) =>
  compareNames(a.name, b.name) || a.created_at.localeCompare(b.created_at);

/** Poed tähestiku järjekorras (eesti keele reeglid). */
export function sortStores<T extends Named>(rows: readonly T[]): T[] {
  return [...rows].sort(byNameThenCreated);
}

/** Tooted: „vaja juurde“ eespool, seejärel tähestiku järjekorras. */
export function sortProducts<T extends Named & { is_needed: boolean }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(b.is_needed) - Number(a.is_needed) || byNameThenCreated(a, b));
}
