import { describe, expect, it } from "vitest";
import {
  clearNeededProducts,
  createProduct,
  deleteProduct,
  getProductsByStore,
  toggleProductNeeded,
  updateProduct,
  updateProductFields,
} from "@/lib/data/products";
import { createFakeSupabase, product, PRODUCT_ID, STORE_ID } from "./helpers/fakeSupabase";

describe("getProductsByStore", () => {
  it("sorteerib: „vaja juurde“ eespool, siis nime järgi", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [product({ is_needed: true, name: "Z" }), product({ name: "A" })] });

    const r = await getProductsByStore(fake.db, STORE_ID);

    expect(r.ok && r.data.map((p) => p.name)).toEqual(["Z", "A"]);
    expect(fake.calls[0].table).toBe("products");
    expect(fake.argsOf("eq")).toEqual([["store_id", STORE_ID]]);
    expect(fake.argsOf("order").slice(0, 2)).toEqual([
      ["is_needed", { ascending: false }],
      ["name", { ascending: true }],
    ]);
  });

  it("tagastab tühja loetelu, kui poes pole tooteid", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] }, { data: { id: STORE_ID } });
    expect(await getProductsByStore(fake.db, STORE_ID)).toEqual({ ok: true, data: [] });
    expect(fake.calls.map((c) => c.table)).toEqual(["products", "stores"]);
  });

  it("tagastab NOT_FOUND, kui poodi pole (või see on teise kasutaja oma)", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] }, { data: null });
    expect(await getProductsByStore(fake.db, STORE_ID)).toMatchObject({ code: "NOT_FOUND", error: "Poodi ei leitud." });
  });

  it("poe kontrolli viga antakse edasi", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] }, { error: { code: "XX000" } });
    expect(await getProductsByStore(fake.db, STORE_ID)).toMatchObject({ code: "UNKNOWN" });
  });

  it("keelab vigase poe ID", async () => {
    const fake = createFakeSupabase();
    expect(await getProductsByStore(fake.db, "x")).toMatchObject({ code: "VALIDATION" });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("createProduct", () => {
  it("lisab toote puhastatud nimega ja vaikimisi is_needed = false (andmebaasist)", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: product({ name: "Küünelakk" }) });

    const r = await createProduct(fake.db, STORE_ID, "  Küünelakk ");

    expect(r).toEqual({ ok: true, data: product({ name: "Küünelakk" }) });
    expect(fake.argsOf("insert")).toEqual([[{ store_id: STORE_ID, name: "Küünelakk" }]]);
  });

  it("ei lisa tühja nimega toodet", async () => {
    const fake = createFakeSupabase();
    expect(await createProduct(fake.db, STORE_ID, "")).toEqual({
      ok: false,
      code: "VALIDATION",
      error: "Toote nimi ei tohi olla tühi.",
    });
    expect(fake.calls).toHaveLength(0);
  });

  it("tagastab „Poodi ei leitud“, kui poodi pole (foreign key)", async () => {
    const fake = createFakeSupabase();
    fake.respond({ error: { code: "23503", message: "violates foreign key constraint" } });
    expect(await createProduct(fake.db, STORE_ID, "Toode")).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Poodi ei leitud.",
    });
  });

  it("keelab vigase poe ID", async () => {
    const fake = createFakeSupabase();
    expect(await createProduct(fake.db, "nope", "Toode")).toMatchObject({ error: "Vigane poe ID." });
  });
});

describe("toggleProductNeeded", () => {
  it.each([true, false])("seab is_needed = %s", async (value) => {
    const fake = createFakeSupabase();
    fake.respond({ data: product({ is_needed: value }) });

    const r = await toggleProductNeeded(fake.db, PRODUCT_ID, value);

    expect(r).toEqual({ ok: true, data: product({ is_needed: value }) });
    expect(fake.argsOf("update")).toEqual([[{ is_needed: value }]]);
    expect(fake.argsOf("eq")).toEqual([["id", PRODUCT_ID]]);
  });

  it("keelab mitte-tõeväärtuse", async () => {
    const fake = createFakeSupabase();
    expect(await toggleProductNeeded(fake.db, PRODUCT_ID, "true")).toMatchObject({ code: "VALIDATION" });
    expect(fake.calls).toHaveLength(0);
  });

  it("tagastab NOT_FOUND, kui toodet pole", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: null });
    expect(await toggleProductNeeded(fake.db, PRODUCT_ID, true)).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Toodet ei leitud.",
    });
  });
});

describe("updateProduct", () => {
  it("muudab ainult nime", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: product({ name: "Uus" }) });
    expect(await updateProduct(fake.db, PRODUCT_ID, " Uus ")).toEqual({ ok: true, data: product({ name: "Uus" }) });
    expect(fake.argsOf("update")).toEqual([[{ name: "Uus" }]]);
  });

  it("keelab tühja nime", async () => {
    const fake = createFakeSupabase();
    expect(await updateProduct(fake.db, PRODUCT_ID, " ")).toMatchObject({ error: "Toote nimi ei tohi olla tühi." });
  });

  it("annab unikaalsuse korral toote-spetsiifilise teate", async () => {
    const fake = createFakeSupabase();
    fake.respond({ error: { code: "23505" } });
    expect(await updateProduct(fake.db, PRODUCT_ID, "X")).toMatchObject({
      code: "CONFLICT",
      error: "Sellise nimega toode on selles poes juba olemas.",
    });
  });
});

describe("updateProductFields", () => {
  it("ainult märge", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: product({ is_needed: true }) });
    await updateProductFields(fake.db, PRODUCT_ID, { isNeeded: true });
    expect(fake.argsOf("update")).toEqual([[{ is_needed: true }]]);
  });

  it("vigane väli → ühtegi päringut ei tehta", async () => {
    const fake = createFakeSupabase();
    expect(await updateProductFields(fake.db, PRODUCT_ID, { name: "Uus", isNeeded: "jah" })).toMatchObject({
      code: "VALIDATION",
    });
    expect(await updateProductFields(fake.db, PRODUCT_ID, { name: "", isNeeded: true })).toMatchObject({
      code: "VALIDATION",
    });
    expect(fake.calls).toHaveLength(0);
  });

  it("tühi muudatus → VALIDATION", async () => {
    const fake = createFakeSupabase();
    expect(await updateProductFields(fake.db, PRODUCT_ID, {})).toMatchObject({ code: "VALIDATION" });
  });

  it("vigane ID", async () => {
    const fake = createFakeSupabase();
    expect(await updateProductFields(fake.db, "x", { name: "a" })).toMatchObject({ error: "Vigane toote ID." });
  });
});

describe("deleteProduct", () => {
  it("kustutab toote ja tagastab poe ID (vahemälu värskendamiseks)", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [{ id: PRODUCT_ID, store_id: STORE_ID }] });
    expect(await deleteProduct(fake.db, PRODUCT_ID)).toEqual({ ok: true, data: { id: PRODUCT_ID, store_id: STORE_ID } });
    expect(fake.methodsOf()).toEqual(["delete", "eq", "select"]);
  });

  it("tagastab NOT_FOUND, kui midagi ei kustutatud", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] });
    expect(await deleteProduct(fake.db, PRODUCT_ID)).toMatchObject({ code: "NOT_FOUND", error: "Toodet ei leitud." });
  });
});

describe("clearNeededProducts", () => {
  it("võtab märke maha ainult selle poe märgitud toodetelt", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [{ id: "a" }, { id: "b" }] });

    expect(await clearNeededProducts(fake.db, STORE_ID)).toEqual({ ok: true, data: { updated: 2 } });
    expect(fake.argsOf("update")).toEqual([[{ is_needed: false }]]);
    expect(fake.argsOf("eq")).toEqual([
      ["store_id", STORE_ID],
      ["is_needed", true],
    ]);
  });

  it("ühtegi märget polnud → kontrollib, et pood on olemas", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] }, { data: { id: STORE_ID } });
    expect(await clearNeededProducts(fake.db, STORE_ID)).toEqual({ ok: true, data: { updated: 0 } });
  });

  it("puuduv pood → NOT_FOUND", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [] }, { data: null });
    expect(await clearNeededProducts(fake.db, STORE_ID)).toMatchObject({ code: "NOT_FOUND" });
  });

  it("ei uuenda kunagi ilma poe filtrita", async () => {
    const fake = createFakeSupabase();
    expect(await clearNeededProducts(fake.db, "")).toMatchObject({ code: "VALIDATION" });
    expect(fake.calls).toHaveLength(0);
  });
});
