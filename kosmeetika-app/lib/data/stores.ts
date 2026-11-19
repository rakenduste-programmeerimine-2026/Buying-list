import { mapDbError, mapUnexpected, notFound } from "./errors";
import { success, type ActionResult } from "./result";
import type { DbClient, Store, StoreWithCounts, StoreWithProducts } from "./types";
import { validateId, validateName } from "./validation";
import { getProductsByStore } from "./products";
import { sortStores } from "./sort";

const STORE_COLUMNS = "id, name, created_at";

type StoreRowWithProducts = Store & { products: { is_needed: boolean }[] | null };

function withCounts({ products, ...store }: StoreRowWithProducts): StoreWithCounts {
  return {
    ...store,
    product_count: products?.length ?? 0,
    needed_count: products?.filter((p) => p.is_needed).length ?? 0,
  };
}

/** Kõik poed tähestiku järjekorras. */
export async function getStores(db: DbClient): Promise<ActionResult<Store[]>> {
  try {
    const { data, error } = await db
      .from("stores")
      .select(STORE_COLUMNS)
      .order("name", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return mapDbError(error, "store", "getStores");
    return success(sortStores(data ?? []));
  } catch (err) {
    return mapUnexpected(err, "getStores");
  }
}

/** Kõik poed tähestiku järjekorras koos toodete ja „vaja juurde“ toodete arvuga. */
export async function getStoresWithCounts(db: DbClient): Promise<ActionResult<StoreWithCounts[]>> {
  try {
    const { data, error } = await db
      .from("stores")
      .select(`${STORE_COLUMNS}, products(is_needed)`)
      .order("name", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return mapDbError(error, "store", "getStoresWithCounts");

    const rows = (data ?? []) as StoreRowWithProducts[];
    return success(sortStores(rows).map(withCounts));
  } catch (err) {
    return mapUnexpected(err, "getStoresWithCounts");
  }
}

/** Ühe poe andmed koos toodete arvuga (nt pärast nime muutmist). */
export async function getStoreWithCountsById(db: DbClient, id: unknown): Promise<ActionResult<StoreWithCounts>> {
  const idCheck = validateId(id, "store");
  if (!idCheck.ok) return idCheck;
  try {
    const { data, error } = await db
      .from("stores")
      .select(`${STORE_COLUMNS}, products(is_needed)`)
      .eq("id", idCheck.value)
      .maybeSingle();
    if (error) return mapDbError(error, "store", "getStoreWithCountsById");
    if (!data) return notFound("store");
    return success(withCounts(data as StoreRowWithProducts));
  } catch (err) {
    return mapUnexpected(err, "getStoreWithCountsById");
  }
}

/** Ühe poe andmed. Kui poodi pole, tagastab NOT_FOUND. */
export async function getStoreById(db: DbClient, id: unknown): Promise<ActionResult<Store>> {
  const idCheck = validateId(id, "store");
  if (!idCheck.ok) return idCheck;
  try {
    const { data, error } = await db.from("stores").select(STORE_COLUMNS).eq("id", idCheck.value).maybeSingle();
    if (error) return mapDbError(error, "store", "getStoreById");
    if (!data) return notFound("store");
    return success(data);
  } catch (err) {
    return mapUnexpected(err, "getStoreById");
  }
}

/** Pood koos toodetega („vaja juurde“ tooted eespool). */
export async function getStoreWithProducts(db: DbClient, id: unknown): Promise<ActionResult<StoreWithProducts>> {
  const store = await getStoreById(db, id);
  if (!store.ok) return store;
  const products = await getProductsByStore(db, store.data.id, { storeKnownToExist: true });
  if (!products.ok) return products;
  return success({ ...store.data, products: products.data });
}

/** Uue poe lisamine. Nimi puhastatakse tühikutest, tühja nime ei lubata. */
export async function createStore(db: DbClient, name: unknown): Promise<ActionResult<Store>> {
  const nameCheck = validateName(name, "store");
  if (!nameCheck.ok) return nameCheck;
  try {
    const { data, error } = await db.from("stores").insert({ name: nameCheck.value }).select(STORE_COLUMNS).single();
    if (error) return mapDbError(error, "store", "createStore");
    return success(data);
  } catch (err) {
    return mapUnexpected(err, "createStore");
  }
}

/** Poe nime muutmine. */
export async function updateStore(db: DbClient, id: unknown, name: unknown): Promise<ActionResult<Store>> {
  const idCheck = validateId(id, "store");
  if (!idCheck.ok) return idCheck;
  const nameCheck = validateName(name, "store");
  if (!nameCheck.ok) return nameCheck;
  try {
    // .select() on vajalik: kui RLS keelab või rida puudub, tuleb tühi tulemus ilma veata.
    const { data, error } = await db
      .from("stores")
      .update({ name: nameCheck.value })
      .eq("id", idCheck.value)
      .select(STORE_COLUMNS)
      .maybeSingle();
    if (error) return mapDbError(error, "store", "updateStore");
    if (!data) return notFound("store");
    return success(data);
  } catch (err) {
    return mapUnexpected(err, "updateStore");
  }
}

/** Poe kustutamine. Andmebaas kustutab ka poe tooted (ON DELETE CASCADE). */
export async function deleteStore(db: DbClient, id: unknown): Promise<ActionResult<{ id: string }>> {
  const idCheck = validateId(id, "store");
  if (!idCheck.ok) return idCheck;
  try {
    const { data, error } = await db.from("stores").delete().eq("id", idCheck.value).select("id");
    if (error) return mapDbError(error, "store", "deleteStore");
    if (!data || data.length === 0) return notFound("store");
    return success({ id: idCheck.value });
  } catch (err) {
    return mapUnexpected(err, "deleteStore");
  }
}
