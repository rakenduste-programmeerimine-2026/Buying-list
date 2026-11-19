import { mapDbError, mapUnexpected, notFound } from "./errors";
import { failure, success, type ActionResult } from "./result";
import type { DbClient, Product } from "./types";
import { sortProducts } from "./sort";
import { validateBoolean, validateId, validateName } from "./validation";

const PRODUCT_COLUMNS = "id, store_id, name, is_needed, created_at";

/**
 * Kas pood on olemas (ja RLS-i järgi selle kasutaja oma)?
 * Kasutatakse ainult siis, kui päring tagastas tühja tulemuse, et eristada
 * „poes pole tooteid“ ja „poodi pole“.
 */
async function storeExists(db: DbClient, storeId: string): Promise<boolean | ActionResult<never>> {
  const { data, error } = await db.from("stores").select("id").eq("id", storeId).maybeSingle();
  if (error) return mapDbError(error, "store", "storeExists");
  return data !== null;
}

/**
 * Poe tooted: „vaja juurde“ tooted eespool, seejärel tähestiku järjekorras.
 * Andmebaas sorteerib (nagu ülesandes näidatud), seejärel täpsustame eesti
 * tähestiku järgi (vt sort.ts).
 */
export async function getProductsByStore(
  db: DbClient,
  storeId: unknown,
  options: { storeKnownToExist?: boolean } = {},
): Promise<ActionResult<Product[]>> {
  const idCheck = validateId(storeId, "store");
  if (!idCheck.ok) return idCheck;
  try {
    const { data, error } = await db
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("store_id", idCheck.value)
      .order("is_needed", { ascending: false })
      .order("name", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return mapDbError(error, "product", "getProductsByStore");
    const rows = data ?? [];
    if (rows.length === 0 && !options.storeKnownToExist) {
      const exists = await storeExists(db, idCheck.value);
      if (exists !== true) return exists === false ? notFound("store") : exists;
    }
    return success(sortProducts(rows));
  } catch (err) {
    return mapUnexpected(err, "getProductsByStore");
  }
}

/**
 * Uue toote lisamine poele. Kui poodi pole (või see kuulub teisele kasutajale),
 * tagastab NOT_FOUND: RLS-i `with check` annab siis 42501, foreign key 23503.
 */
export async function createProduct(db: DbClient, storeId: unknown, name: unknown): Promise<ActionResult<Product>> {
  const idCheck = validateId(storeId, "store");
  if (!idCheck.ok) return idCheck;
  const nameCheck = validateName(name, "product");
  if (!nameCheck.ok) return nameCheck;
  try {
    const { data, error } = await db
      .from("products")
      .insert({ store_id: idCheck.value, name: nameCheck.value })
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23503") return notFound("store");
      if (error.code === "42501") {
        // RLS `with check` keeldus: kas pood puudub/on teise kasutaja oma (→ 404)
        // või on tegu päris õiguste probleemiga (→ 403, logitakse)?
        const exists = await storeExists(db, idCheck.value);
        if (exists === false) return notFound("store");
        if (exists !== true) return exists;
      }
      return mapDbError(error, "product", "createProduct");
    }
    return success(data);
  } catch (err) {
    return mapUnexpected(err, "createProduct");
  }
}

/** „Vaja juurde“ märke muutmine. */
export async function toggleProductNeeded(
  db: DbClient,
  id: unknown,
  isNeeded: unknown,
): Promise<ActionResult<Product>> {
  const idCheck = validateId(id, "product");
  if (!idCheck.ok) return idCheck;
  const flag = validateBoolean(isNeeded);
  if (!flag.ok) return flag;
  return updateProductRow(db, idCheck.value, { is_needed: flag.value }, "toggleProductNeeded");
}

/** Toote nime muutmine. */
export async function updateProduct(db: DbClient, id: unknown, name: unknown): Promise<ActionResult<Product>> {
  const idCheck = validateId(id, "product");
  if (!idCheck.ok) return idCheck;
  const nameCheck = validateName(name, "product");
  if (!nameCheck.ok) return nameCheck;
  return updateProductRow(db, idCheck.value, { name: nameCheck.value }, "updateProduct");
}

/**
 * Toote nime ja/või „vaja juurde“ märke muutmine ÜHE päringuga
 * (kumbki muudatus ei jää pooleli, kui teine ebaõnnestub).
 */
export async function updateProductFields(
  db: DbClient,
  id: unknown,
  fields: { name?: unknown; isNeeded?: unknown },
): Promise<ActionResult<Product>> {
  const idCheck = validateId(id, "product");
  if (!idCheck.ok) return idCheck;
  const patch: { name?: string; is_needed?: boolean } = {};
  if (fields.name !== undefined) {
    const nameCheck = validateName(fields.name, "product");
    if (!nameCheck.ok) return nameCheck;
    patch.name = nameCheck.value;
  }
  if (fields.isNeeded !== undefined) {
    const flag = validateBoolean(fields.isNeeded);
    if (!flag.ok) return flag;
    patch.is_needed = flag.value;
  }
  if (Object.keys(patch).length === 0) {
    return failure("VALIDATION", "Muudatusi pole: saada „name“ ja/või „needed“.");
  }
  return updateProductRow(db, idCheck.value, patch, "updateProductFields");
}

/** Toote kustutamine. */
export async function deleteProduct(
  db: DbClient,
  id: unknown,
): Promise<ActionResult<{ id: string; store_id: string }>> {
  const idCheck = validateId(id, "product");
  if (!idCheck.ok) return idCheck;
  try {
    const { data, error } = await db.from("products").delete().eq("id", idCheck.value).select("id, store_id");
    if (error) return mapDbError(error, "product", "deleteProduct");
    if (!data || data.length === 0) return notFound("product");
    return success(data[0]);
  } catch (err) {
    return mapUnexpected(err, "deleteProduct");
  }
}

/** Võtab poe kõigilt toodetelt „vaja juurde“ märke maha. Tagastab muudetud toodete arvu. */
export async function clearNeededProducts(
  db: DbClient,
  storeId: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const idCheck = validateId(storeId, "store");
  if (!idCheck.ok) return idCheck;
  try {
    const { data, error } = await db
      .from("products")
      .update({ is_needed: false })
      .eq("store_id", idCheck.value)
      .eq("is_needed", true)
      .select("id");
    if (error) return mapDbError(error, "product", "clearNeededProducts");
    const updated = data?.length ?? 0;
    if (updated === 0) {
      const exists = await storeExists(db, idCheck.value);
      if (exists !== true) return exists === false ? notFound("store") : exists;
    }
    return success({ updated });
  } catch (err) {
    return mapUnexpected(err, "clearNeededProducts");
  }
}

async function updateProductRow(
  db: DbClient,
  id: string,
  patch: { name?: string; is_needed?: boolean },
  context: string,
): Promise<ActionResult<Product>> {
  try {
    const { data, error } = await db
      .from("products")
      .update(patch)
      .eq("id", id)
      .select(PRODUCT_COLUMNS)
      .maybeSingle();
    if (error) return mapDbError(error, "product", context);
    if (!data) return notFound("product");
    return success(data);
  } catch (err) {
    return mapUnexpected(err, context);
  }
}
