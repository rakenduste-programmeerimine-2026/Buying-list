"use server";

/**
 * Toodete Server Actions. Tagastavad `ActionResult` (vt lib/actions/stores.ts).
 */
import * as products from "@/lib/data/products";
import type { ActionResult } from "@/lib/data/result";
import type { Product } from "@/lib/data/types";
import { revalidateStores, withDb } from "./run";

/** Poe tooted, „vaja juurde“ tooted eespool, seejärel tähestiku järjekorras. */
export async function getProductsByStore(storeId: string): Promise<ActionResult<Product[]>> {
  return withDb("getProductsByStore", (db) => products.getProductsByStore(db, storeId));
}

/** Uue toote lisamine poele. */
export async function createProduct(storeId: string, name: string): Promise<ActionResult<Product>> {
  const result = await withDb("createProduct", (db) => products.createProduct(db, storeId, name));
  if (result.ok) revalidateStores(result.data.store_id);
  return result;
}

/** „Vaja juurde“ märke muutmine. */
export async function toggleProductNeeded(id: string, isNeeded: boolean): Promise<ActionResult<Product>> {
  const result = await withDb("toggleProductNeeded", (db) => products.toggleProductNeeded(db, id, isNeeded));
  if (result.ok) revalidateStores(result.data.store_id);
  return result;
}

/** Toote nime muutmine. */
export async function updateProduct(id: string, name: string): Promise<ActionResult<Product>> {
  const result = await withDb("updateProduct", (db) => products.updateProduct(db, id, name));
  if (result.ok) revalidateStores(result.data.store_id);
  return result;
}

/** Toote kustutamine. */
export async function deleteProduct(id: string): Promise<ActionResult<{ id: string; store_id: string }>> {
  const result = await withDb("deleteProduct", (db) => products.deleteProduct(db, id));
  if (result.ok) revalidateStores(result.data.store_id);
  return result;
}

/** Võtab poe kõigilt toodetelt „vaja juurde“ märke maha. */
export async function clearNeededProducts(storeId: string): Promise<ActionResult<{ updated: number }>> {
  const result = await withDb("clearNeededProducts", (db) => products.clearNeededProducts(db, storeId));
  if (result.ok) revalidateStores(storeId);
  return result;
}

/**
 * Vormi variant `useActionState` jaoks. Vorm peab sisaldama välju `storeId` ja `name`.
 */
export async function createProductFromForm(
  _prev: ActionResult<Product> | null,
  formData: FormData,
): Promise<ActionResult<Product>> {
  return createProduct(formData.get("storeId") as string, formData.get("name") as string);
}
