import { mapDbError, mapUnexpected, notFound } from "./errors";
import { success, type ActionResult } from "./result";
import type { DbClient, Product } from "./types";
import { validateBoolean, validateId, validateName } from "./validation";

const PRODUCT_COLUMNS = "id, store_id, name, is_needed, created_at";

/**
 * Poe tooted: „vaja juurde“ tooted eespool, seejärel tähestiku järjekorras.
 */
export async function getProductsByStore(db: DbClient, storeId: unknown): Promise<ActionResult<Product[]>> {
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
    return success(data ?? []);
  } catch (err) {
    return mapUnexpected(err, "getProductsByStore");
  }
}

/** Uue toote lisamine poele. Kui poodi pole, tagastab NOT_FOUND. */
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
    if (error) return mapDbError(error, "product", "createProduct");
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
    return success({ updated: data?.length ?? 0 });
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
