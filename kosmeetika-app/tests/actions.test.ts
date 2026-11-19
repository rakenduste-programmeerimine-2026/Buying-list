import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, product, PRODUCT_ID, store, STORE_ID } from "./helpers/fakeSupabase";

const state = vi.hoisted(() => ({ fake: null as ReturnType<typeof createFakeSupabase> | null, fail: false }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    if (state.fail) throw new Error("Supabase'i seadistus puudub: test");
    return state.fake!.db;
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const storeActions = await import("@/lib/actions/stores");
const productActions = await import("@/lib/actions/products");

beforeEach(() => {
  state.fake = createFakeSupabase();
  state.fail = false;
  vi.mocked(revalidatePath).mockClear();
});

describe("store actions", () => {
  it("createStore lisab poe ja värskendab avalehe", async () => {
    state.fake!.respond({ data: store() });
    expect(await storeActions.createStore(" Pood ")).toEqual({ ok: true, data: store() });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("createStore ei värskenda vahemälu vea korral", async () => {
    expect(await storeActions.createStore("")).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("puuduva seadistuse korral CONFIG viga, mitte erand", async () => {
    state.fail = true;
    expect(await storeActions.getStores()).toEqual({
      ok: false,
      code: "CONFIG",
      error: "Andmebaasi ühendus ei ole seadistatud.",
    });
  });

  it("Auth teenuse katkestus → UNKNOWN, mitte „pole sisse logitud“", async () => {
    (state.fake!.auth as unknown as Record<string, unknown>).getClaims = async () => ({
      data: null,
      error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    });
    expect(await storeActions.getStores()).toEqual({
      ok: false,
      code: "UNKNOWN",
      error: "Sisselogimise teenusega ei saanud ühendust. Proovi hiljem uuesti.",
    });
  });

  it("aegunud/vigane token → UNAUTHORIZED", async () => {
    (state.fake!.auth as unknown as Record<string, unknown>).getClaims = async () => ({
      data: null,
      error: { name: "AuthInvalidJwtError", status: 400, message: "invalid JWT" },
    });
    expect(await storeActions.getStores()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("getClaims viskab erandi → UNKNOWN", async () => {
    (state.fake!.auth as unknown as Record<string, unknown>).getClaims = async () => {
      throw new Error("boom");
    };
    expect(await storeActions.getStores()).toMatchObject({ code: "UNKNOWN" });
  });

  it("väljalogitud kasutaja → UNAUTHORIZED, mitte tühi loetelu", async () => {
    state.fake!.signOut();
    expect(await storeActions.getStores()).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(await productActions.createProduct(STORE_ID, "x")).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(state.fake!.calls).toHaveLength(0);
  });

  it("updateStore värskendab avalehe ja poe lehe", async () => {
    state.fake!.respond({ data: store({ name: "Uus" }) });
    await storeActions.updateStore(STORE_ID, "Uus");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith(`/stores/${STORE_ID}`);
  });

  it("deleteStore", async () => {
    state.fake!.respond({ data: [{ id: STORE_ID }] });
    expect(await storeActions.deleteStore(STORE_ID)).toEqual({ ok: true, data: { id: STORE_ID } });
  });

  it("getStoreById, getStoresWithCounts, getStoreWithProducts", async () => {
    state.fake!.respond({ data: store() });
    expect(await storeActions.getStoreById(STORE_ID)).toEqual({ ok: true, data: store() });
    state.fake!.respond({ data: [{ ...store(), products: [] }] });
    expect((await storeActions.getStoresWithCounts()).ok).toBe(true);
    state.fake!.respond({ data: store() }, { data: [] });
    expect(await storeActions.getStoreWithProducts(STORE_ID)).toEqual({ ok: true, data: { ...store(), products: [] } });
  });

  it("createStoreFromForm loeb välja „name“", async () => {
    state.fake!.respond({ data: store({ name: "Vormist" }) });
    const fd = new FormData();
    fd.set("name", "  Vormist ");
    expect(await storeActions.createStoreFromForm(null, fd)).toEqual({ ok: true, data: store({ name: "Vormist" }) });
    expect(state.fake!.argsOf("insert")).toEqual([[{ name: "Vormist" }]]);
  });

  it("createStoreFromForm ilma väljata → VALIDATION", async () => {
    expect(await storeActions.createStoreFromForm(null, new FormData())).toMatchObject({ code: "VALIDATION" });
  });
});

describe("product actions", () => {
  it("createProduct värskendab poe lehe", async () => {
    state.fake!.respond({ data: product() });
    expect(await productActions.createProduct(STORE_ID, "Vatipadjad")).toEqual({ ok: true, data: product() });
    expect(revalidatePath).toHaveBeenCalledWith(`/stores/${STORE_ID}`);
  });

  it("toggleProductNeeded", async () => {
    state.fake!.respond({ data: product({ is_needed: true }) });
    expect(await productActions.toggleProductNeeded(PRODUCT_ID, true)).toEqual({
      ok: true,
      data: product({ is_needed: true }),
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/stores/${STORE_ID}`);
  });

  it("updateProduct, deleteProduct, clearNeededProducts, getProductsByStore", async () => {
    state.fake!.respond({ data: product({ name: "X" }) });
    expect((await productActions.updateProduct(PRODUCT_ID, "X")).ok).toBe(true);
    state.fake!.respond({ data: [{ id: PRODUCT_ID, store_id: STORE_ID }] });
    expect((await productActions.deleteProduct(PRODUCT_ID)).ok).toBe(true);
    state.fake!.respond({ data: [{ id: PRODUCT_ID }] });
    expect(await productActions.clearNeededProducts(STORE_ID)).toEqual({ ok: true, data: { updated: 1 } });
    state.fake!.respond({ data: [product()] });
    expect(await productActions.getProductsByStore(STORE_ID)).toEqual({ ok: true, data: [product()] });
  });

  it("createProductFromForm", async () => {
    state.fake!.respond({ data: product() });
    const fd = new FormData();
    fd.set("storeId", STORE_ID);
    fd.set("name", "Vatipadjad");
    expect(await productActions.createProductFromForm(null, fd)).toEqual({ ok: true, data: product() });
  });

  it("clearNeededProducts ei värskenda vahemälu vigase ID korral", async () => {
    expect(await productActions.clearNeededProducts("../../etc")).toMatchObject({ code: "VALIDATION" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
