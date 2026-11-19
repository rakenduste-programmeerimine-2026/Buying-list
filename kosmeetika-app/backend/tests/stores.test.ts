import { describe, expect, it } from "vitest";
import {
  createStore,
  deleteStore,
  getStoreById,
  getStores,
  getStoresWithCounts,
  getStoreWithProducts,
  updateStore,
} from "@/lib/data/stores";
import { createFakeSupabase, product, store, STORE_ID, STORE_ID_2 } from "./helpers/fakeSupabase";

describe("getStores", () => {
  it("tagastab poed tähestiku järjekorras", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [store({ name: "A" }), store({ id: STORE_ID_2, name: "B" })] });

    const r = await getStores(fake.db);

    expect(r).toEqual({ ok: true, data: [store({ name: "A" }), store({ id: STORE_ID_2, name: "B" })] });
    expect(fake.calls[0].table).toBe("stores");
    expect(fake.argsOf("order")[0]).toEqual(["name", { ascending: true }]);
  });

  it("tagastab tühja loetelu, kui poode pole", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: null });
    expect(await getStores(fake.db)).toEqual({ ok: true, data: [] });
  });

  it("annab andmebaasi vea korral üldise teate, ilma tehniliste detailideta", async () => {
    const fake = createFakeSupabase();
    fake.respond({ error: { code: "XX000", message: 'relation "stores" does not exist' } });

    const r = await getStores(fake.db);

    expect(r).toEqual({ ok: false, code: "UNKNOWN", error: "Midagi läks valesti. Proovi hiljem uuesti." });
    if (!r.ok) expect(r.error).not.toContain("relation");
  });

  it("annab võrguvea korral selge teate", async () => {
    const fake = createFakeSupabase();
    fake.throwOnNext();
    expect(await getStores(fake.db)).toMatchObject({ ok: false, code: "UNKNOWN" });
  });

  it("RLS keelu korral FORBIDDEN", async () => {
    const fake = createFakeSupabase();
    fake.respond({ error: { code: "42501", message: "permission denied for table stores" } });
    expect(await getStores(fake.db)).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "Sul pole selle toimingu jaoks õigust.",
    });
  });
});

describe("getStoresWithCounts", () => {
  it("loeb kokku tooted ja „vaja juurde“ tooted", async () => {
    const fake = createFakeSupabase();
    fake.respond({
      data: [
        { ...store(), products: [{ is_needed: true }, { is_needed: false }, { is_needed: true }] },
        { ...store({ id: STORE_ID_2, name: "Tühi pood" }), products: [] },
        { ...store({ id: STORE_ID_2, name: "Null" }), products: null },
      ],
    });

    const r = await getStoresWithCounts(fake.db);

    expect(r.ok && r.data).toEqual([
      { ...store(), product_count: 3, needed_count: 2 },
      { ...store({ id: STORE_ID_2, name: "Null" }), product_count: 0, needed_count: 0 },
      { ...store({ id: STORE_ID_2, name: "Tühi pood" }), product_count: 0, needed_count: 0 },
    ]);
    expect(fake.argsOf("select")[0][0]).toContain("products(is_needed)");
  });
});

describe("getStoreById", () => {
  it("tagastab poe", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: store() });
    expect(await getStoreById(fake.db, STORE_ID)).toEqual({ ok: true, data: store() });
    expect(fake.argsOf("eq")).toEqual([["id", STORE_ID]]);
  });

  it("tagastab NOT_FOUND, kui poodi pole", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: null });
    expect(await getStoreById(fake.db, STORE_ID)).toEqual({ ok: false, code: "NOT_FOUND", error: "Poodi ei leitud." });
  });

  it("ei tee päringut vigase ID-ga", async () => {
    const fake = createFakeSupabase();
    expect(await getStoreById(fake.db, "abc")).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("getStoreWithProducts", () => {
  it("tagastab poe koos toodetega", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: store() }, { data: [product({ is_needed: true }), product({ name: "B" })] });

    const r = await getStoreWithProducts(fake.db, STORE_ID);

    expect(r).toEqual({ ok: true, data: { ...store(), products: [product({ is_needed: true }), product({ name: "B" })] } });
    expect(fake.calls.map((c) => c.table)).toEqual(["stores", "products"]);
  });

  it("ei küsi tooteid, kui poodi pole", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: null });
    expect(await getStoreWithProducts(fake.db, STORE_ID)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(fake.calls).toHaveLength(1);
  });
});

describe("createStore", () => {
  it("lisab poe puhastatud nimega", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: store({ name: "Uus pood" }) });

    const r = await createStore(fake.db, "  Uus pood  ");

    expect(r).toEqual({ ok: true, data: store({ name: "Uus pood" }) });
    expect(fake.argsOf("insert")).toEqual([[{ name: "Uus pood" }]]);
  });

  it("ei lisa tühja nimega poodi", async () => {
    const fake = createFakeSupabase();
    expect(await createStore(fake.db, "   ")).toEqual({
      ok: false,
      code: "VALIDATION",
      error: "Poe nimi ei tohi olla tühi.",
    });
    expect(fake.calls).toHaveLength(0);
  });

  it("ei luba kliendil määrata muid välju (nt id, created_at)", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: store() });
    await createStore(fake.db, "Pood");
    expect(Object.keys((fake.argsOf("insert")[0][0] as object) ?? {})).toEqual(["name"]);
  });

  it("annab unikaalsuse rikkumisel arusaadava teate", async () => {
    const fake = createFakeSupabase();
    fake.respond({ error: { code: "23505", message: "duplicate key" } });
    expect(await createStore(fake.db, "Pood")).toEqual({
      ok: false,
      code: "CONFLICT",
      error: "Sellise nimega pood on juba olemas.",
    });
  });
});

describe("updateStore", () => {
  it("muudab nime", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: { ...store({ name: "Uus nimi" }), products: [{ is_needed: false }] } });

    const r = await updateStore(fake.db, STORE_ID, " Uus nimi ");

    expect(r).toEqual({ ok: true, data: { ...store({ name: "Uus nimi" }), product_count: 1, needed_count: 0 } });
    expect(fake.argsOf("update")).toEqual([[{ name: "Uus nimi" }]]);
    expect(fake.argsOf("eq")).toEqual([["id", STORE_ID]]);
    expect(fake.methodsOf()).toContain("select");
  });

  it("tagastab NOT_FOUND, kui ühtegi rida ei muudetud (pood puudub või RLS keelab)", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: null });
    expect(await updateStore(fake.db, STORE_ID, "X")).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("valideerib nii ID kui ka nime", async () => {
    const fake = createFakeSupabase();
    expect(await updateStore(fake.db, "bad", "X")).toMatchObject({ code: "VALIDATION", error: "Vigane poe ID." });
    expect(await updateStore(fake.db, STORE_ID, "")).toMatchObject({ code: "VALIDATION", error: "Poe nimi ei tohi olla tühi." });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("deleteStore", () => {
  it("kustutab poe", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [{ id: STORE_ID }] });
    expect(await deleteStore(fake.db, STORE_ID)).toEqual({ ok: true, data: { id: STORE_ID } });
    expect(fake.methodsOf()).toEqual(["delete", "eq", "select"]);
  });

  it("tagastab NOT_FOUND, kui midagi ei kustutatud", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] });
    expect(await deleteStore(fake.db, STORE_ID)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("ei kustuta kunagi ilma ID filtrita", async () => {
    const fake = createFakeSupabase();
    expect(await deleteStore(fake.db, undefined)).toMatchObject({ code: "VALIDATION" });
    expect(fake.calls).toHaveLength(0);
  });
});
