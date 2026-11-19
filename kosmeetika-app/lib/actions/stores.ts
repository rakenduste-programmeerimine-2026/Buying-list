"use server";

/**
 * Poodide Server Actions.
 *
 * Iga funktsioon tagastab `ActionResult`:
 *   { ok: true, data }               – õnnestus
 *   { ok: false, error, code }       – `error` on eestikeelne teade kasutajale
 *
 * NB: Server Actions on avalikud POST-otspunktid, seega kogu sisend
 * valideeritakse siin uuesti (ka siis, kui frontend juba kontrollis).
 */
import * as stores from "@/lib/data/stores";
import type { ActionResult } from "@/lib/data/result";
import type { Store, StoreWithCounts, StoreWithProducts } from "@/lib/data/types";
import { revalidateStores, withDb } from "./run";

/** Kõik poed tähestiku järjekorras. */
export async function getStores(): Promise<ActionResult<Store[]>> {
  return withDb("getStores", (db) => stores.getStores(db));
}

/** Kõik poed koos toodete arvu ja „vaja juurde“ arvuga. */
export async function getStoresWithCounts(): Promise<ActionResult<StoreWithCounts[]>> {
  return withDb("getStoresWithCounts", (db) => stores.getStoresWithCounts(db));
}

/** Ühe poe andmed. */
export async function getStoreById(id: string): Promise<ActionResult<Store>> {
  return withDb("getStoreById", (db) => stores.getStoreById(db, id));
}

/** Pood koos sorteeritud toodetega. */
export async function getStoreWithProducts(id: string): Promise<ActionResult<StoreWithProducts>> {
  return withDb("getStoreWithProducts", (db) => stores.getStoreWithProducts(db, id));
}

/** Uue poe lisamine. */
export async function createStore(name: string): Promise<ActionResult<Store>> {
  const result = await withDb("createStore", (db) => stores.createStore(db, name));
  if (result.ok) revalidateStores();
  return result;
}

/** Poe nime muutmine. */
export async function updateStore(id: string, name: string): Promise<ActionResult<StoreWithCounts>> {
  const result = await withDb("updateStore", (db) => stores.updateStore(db, id, name));
  if (result.ok) revalidateStores(result.data.id);
  return result;
}

/** Poe (ja selle toodete) kustutamine. */
export async function deleteStore(id: string): Promise<ActionResult<{ id: string }>> {
  const result = await withDb("deleteStore", (db) => stores.deleteStore(db, id));
  if (result.ok) revalidateStores(result.data.id);
  return result;
}

/**
 * Vormi variant `useActionState` jaoks: `<form action={formAction}>` väljaga `name`.
 *
 *   const [state, formAction, pending] = useActionState(createStoreFromForm, null);
 */
export async function createStoreFromForm(
  _prev: ActionResult<Store> | null,
  formData: FormData,
): Promise<ActionResult<Store>> {
  return createStore(formData.get("name") as string);
}
