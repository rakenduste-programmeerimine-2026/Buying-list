import { describe, expect, it } from "vitest";
import * as products from "@/lib/data/products";
import * as stores from "@/lib/data/stores";
import { createFakeSupabase, PRODUCT_ID, STORE_ID } from "./helpers/fakeSupabase";

const DB_ERROR = { code: "XX000", message: "internal" };
type Call = (db: ReturnType<typeof createFakeSupabase>["db"]) => Promise<{ ok: boolean; code?: string }>;

const calls: [string, Call][] = [
  ["getStores", (db) => stores.getStores(db)],
  ["getStoresWithCounts", (db) => stores.getStoresWithCounts(db)],
  ["getStoreById", (db) => stores.getStoreById(db, STORE_ID)],
  ["createStore", (db) => stores.createStore(db, "x")],
  ["updateStore", (db) => stores.updateStore(db, STORE_ID, "x")],
  ["deleteStore", (db) => stores.deleteStore(db, STORE_ID)],
  ["getProductsByStore", (db) => products.getProductsByStore(db, STORE_ID)],
  ["createProduct", (db) => products.createProduct(db, STORE_ID, "x")],
  ["toggleProductNeeded", (db) => products.toggleProductNeeded(db, PRODUCT_ID, true)],
  ["updateProduct", (db) => products.updateProduct(db, PRODUCT_ID, "x")],
  ["deleteProduct", (db) => products.deleteProduct(db, PRODUCT_ID)],
  ["clearNeededProducts", (db) => products.clearNeededProducts(db, STORE_ID)],
];

describe.each(calls)("%s", (_name, call) => {
  it("võrguviga → UNKNOWN, ei viska erandit", async () => {
    const fake = createFakeSupabase();
    fake.throwOnNext();
    expect(await call(fake.db)).toMatchObject({ ok: false, code: "UNKNOWN" });
  });

  it("andmebaasi viga → UNKNOWN", async () => {
    const fake = createFakeSupabase();
    fake.respond({ error: DB_ERROR });
    expect(await call(fake.db)).toMatchObject({ ok: false, code: "UNKNOWN" });
  });
});

describe("getStoreWithProducts", () => {
  it("toodete päringu viga antakse edasi", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: { id: STORE_ID, name: "x", created_at: "" } }, { error: DB_ERROR });
    expect(await stores.getStoreWithProducts(fake.db, STORE_ID)).toMatchObject({ ok: false, code: "UNKNOWN" });
  });
});
