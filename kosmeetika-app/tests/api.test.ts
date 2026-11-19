import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, product, PRODUCT_ID, store, STORE_ID } from "./helpers/fakeSupabase";

const state = vi.hoisted(() => ({ fake: null as ReturnType<typeof createFakeSupabase> | null }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => state.fake!.db) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const storesRoute = await import("@/app/api/stores/route");
const storeRoute = await import("@/app/api/stores/[id]/route");
const storeProductsRoute = await import("@/app/api/stores/[id]/products/route");
const clearNeededRoute = await import("@/app/api/stores/[id]/clear-needed/route");
const productRoute = await import("@/app/api/products/[id]/route");

const BASE = "http://localhost:3000";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000", ...init.headers };
  let body: string | undefined;
  if (init.body !== undefined) {
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    headers["content-type"] ??= "application/json";
  }
  return new Request(`${BASE}${path}`, { method: init.method ?? "GET", body, headers });
}

beforeEach(() => {
  state.fake = createFakeSupabase();
});

describe("GET /api/stores", () => {
  it("tagastab frontendi StoreSummary kuju", async () => {
    state.fake!.respond({ data: [{ ...store(), products: [{ is_needed: true }, { is_needed: false }] }] });
    const res = await storesRoute.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual([{ id: STORE_ID, name: store().name, productCount: 2, neededCount: 1 }]);
  });

  it("veakorral { error, code } ja õige staatus", async () => {
    state.fake!.respond({ error: { code: "42501" } });
    const res = await storesRoute.GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Sul pole selle toimingu jaoks õigust.", code: "FORBIDDEN" });
  });
});

describe("sisselogimine", () => {
  it("väljalogitud kasutaja → 401 ja andmebaasi ei küsita", async () => {
    state.fake!.signOut();
    const res = await storesRoute.GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sa ei ole sisse logitud. Laadi leht uuesti.", code: "UNAUTHORIZED" });
    expect(state.fake!.calls).toHaveLength(0);
  });

  it("väljalogitud kasutaja ei saa poodi lisada", async () => {
    state.fake!.signOut();
    const res = await storesRoute.POST(req("/api/stores", { method: "POST", body: { name: "x" } }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/stores", () => {
  it("lisab poe → 201", async () => {
    state.fake!.respond({ data: store({ name: "Uus" }) });
    const res = await storesRoute.POST(req("/api/stores", { method: "POST", body: { name: " Uus " } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: STORE_ID, name: "Uus", productCount: 0, neededCount: 0 });
  });

  it("tühi nimi → 400 eestikeelse teatega", async () => {
    const res = await storesRoute.POST(req("/api/stores", { method: "POST", body: { name: "  " } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Poe nimi ei tohi olla tühi.", code: "VALIDATION" });
  });

  it("nõuab JSON content-type'i (kaitse HTML-vormi CSRF vastu)", async () => {
    const res = await storesRoute.POST(
      req("/api/stores", { method: "POST", body: "name=x", headers: { "content-type": "application/x-www-form-urlencoded" } }),
    );
    expect(res.status).toBe(400);
    expect(state.fake!.calls).toHaveLength(0);
  });

  it("keelab vigase JSON-i", async () => {
    const res = await storesRoute.POST(req("/api/stores", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Päringu keha ei ole korrektne JSON.");
  });

  it.each([["[]"], ["null"], ['"tekst"']])("keelab mitte-objekti %s", async (body) => {
    const res = await storesRoute.POST(req("/api/stores", { method: "POST", body }));
    expect(res.status).toBe(400);
  });

  it("keelab liiga suure keha", async () => {
    const res = await storesRoute.POST(req("/api/stores", { method: "POST", body: { name: "a".repeat(5000) } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Päring on liiga suur.");
  });

  it("keelab teiselt saidilt tulnud päringu (Origin)", async () => {
    const res = await storesRoute.POST(
      req("/api/stores", { method: "POST", body: { name: "x" }, headers: { origin: "https://evil.example" } }),
    );
    expect(res.status).toBe(403);
    expect(state.fake!.calls).toHaveLength(0);
  });

  it("keelab Sec-Fetch-Site: cross-site", async () => {
    const res = await storesRoute.POST(
      req("/api/stores", { method: "POST", body: { name: "x" }, headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(res.status).toBe(403);
  });

  it.each([
    ["mitu väärtust", { "x-forwarded-host": "kosmeetik.ee, internal:3000", "x-forwarded-proto": "https" }, "https://kosmeetik.ee"],
    ["vaikimisi port", { "x-forwarded-host": "kosmeetik.ee:443", "x-forwarded-proto": "https" }, "https://kosmeetik.ee"],
    ["suurtähed", { "x-forwarded-host": "Kosmeetik.EE" }, "https://kosmeetik.ee"],
  ])("lubab proksi taga sama saidi päringu (%s)", async (_label, headers, origin) => {
    state.fake!.respond({ data: store() });
    const res = await storesRoute.POST(
      req("/api/stores", { method: "POST", body: { name: "x" }, headers: { ...headers, origin } }),
    );
    expect(res.status).toBe(201);
  });

  it("proksi taga teine sait on endiselt keelatud", async () => {
    const res = await storesRoute.POST(
      req("/api/stores", {
        method: "POST",
        body: { name: "x" },
        headers: { "x-forwarded-host": "kosmeetik.ee", origin: "https://kosmeetik.ee.evil.example" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("lubab sama päritoluga päringu", async () => {
    state.fake!.respond({ data: store() });
    const res = await storesRoute.POST(
      req("/api/stores", {
        method: "POST",
        body: { name: "x" },
        headers: { origin: BASE, "sec-fetch-site": "same-origin" },
      }),
    );
    expect(res.status).toBe(201);
  });

  it("ignoreerib lisavälju kehas (nt id)", async () => {
    state.fake!.respond({ data: store() });
    await storesRoute.POST(req("/api/stores", { method: "POST", body: { name: "x", id: "hack", created_at: "1999" } }));
    expect(state.fake!.argsOf("insert")).toEqual([[{ name: "x" }]]);
  });
});

describe("/api/stores/:id", () => {
  it("GET tagastab StoreDetail kuju", async () => {
    state.fake!.respond({ data: store() }, { data: [product({ is_needed: true })] });
    const res = await storeRoute.GET(req(`/api/stores/${STORE_ID}`), ctx(STORE_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: STORE_ID,
      name: store().name,
      products: [{ id: PRODUCT_ID, storeId: STORE_ID, name: "Vatipadjad", needed: true }],
    });
  });

  it("GET puuduva poe korral 404 (frontend näitab „ei leitud“)", async () => {
    state.fake!.respond({ data: null });
    const res = await storeRoute.GET(req(`/api/stores/${STORE_ID}`), ctx(STORE_ID));
    expect(res.status).toBe(404);
  });

  it("GET vigase ID korral 400", async () => {
    const res = await storeRoute.GET(req("/api/stores/abc"), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("PATCH muudab nime ja tagastab õiged toodete arvud", async () => {
    state.fake!.respond(
      { data: store({ name: "Uus" }) },
      { data: { ...store({ name: "Uus" }), products: [{ is_needed: true }, { is_needed: false }] } },
    );
    const res = await storeRoute.PATCH(req(`/api/stores/${STORE_ID}`, { method: "PATCH", body: { name: "Uus" } }), ctx(STORE_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: STORE_ID, name: "Uus", productCount: 2, neededCount: 1 });
  });

  it("PATCH puuduva poe korral 404", async () => {
    state.fake!.respond({ data: null });
    const res = await storeRoute.PATCH(req(`/api/stores/${STORE_ID}`, { method: "PATCH", body: { name: "Uus" } }), ctx(STORE_ID));
    expect(res.status).toBe(404);
  });

  it("DELETE → 204", async () => {
    state.fake!.respond({ data: [{ id: STORE_ID }] });
    const res = await storeRoute.DELETE(req(`/api/stores/${STORE_ID}`, { method: "DELETE" }), ctx(STORE_ID));
    expect(res.status).toBe(204);
  });

  it("DELETE teiselt saidilt → 403, midagi ei kustutata", async () => {
    const res = await storeRoute.DELETE(
      req(`/api/stores/${STORE_ID}`, { method: "DELETE", headers: { origin: "https://evil.example" } }),
      ctx(STORE_ID),
    );
    expect(res.status).toBe(403);
    expect(state.fake!.calls).toHaveLength(0);
  });

  it("DELETE puuduva poe korral 404", async () => {
    state.fake!.respond({ data: [] });
    const res = await storeRoute.DELETE(req(`/api/stores/${STORE_ID}`, { method: "DELETE" }), ctx(STORE_ID));
    expect(res.status).toBe(404);
  });
});

describe("/api/stores/:id/products", () => {
  it("POST lisab toote → 201 Product kujul", async () => {
    state.fake!.respond({ data: product() });
    const res = await storeProductsRoute.POST(
      req(`/api/stores/${STORE_ID}/products`, { method: "POST", body: { name: "Vatipadjad" } }),
      ctx(STORE_ID),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: PRODUCT_ID, storeId: STORE_ID, name: "Vatipadjad", needed: false });
  });

  it("POST olematule poele → 404", async () => {
    state.fake!.respond({ error: { code: "23503" } });
    const res = await storeProductsRoute.POST(
      req(`/api/stores/${STORE_ID}/products`, { method: "POST", body: { name: "X" } }),
      ctx(STORE_ID),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Poodi ei leitud.");
  });

  it("GET puuduva poe korral 404 (mitte tühi loetelu)", async () => {
    state.fake!.respond({ data: [] }, { data: null });
    const res = await storeProductsRoute.GET(req(`/api/stores/${STORE_ID}/products`), ctx(STORE_ID));
    expect(res.status).toBe(404);
  });

  it("POST teise kasutaja poodi (RLS with check → 42501) → 404", async () => {
    state.fake!.respond({ error: { code: "42501" } });
    const res = await storeProductsRoute.POST(
      req(`/api/stores/${STORE_ID}/products`, { method: "POST", body: { name: "X" } }),
      ctx(STORE_ID),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Poodi ei leitud.");
  });

  it("GET tagastab tooted", async () => {
    state.fake!.respond({ data: [product()] });
    const res = await storeProductsRoute.GET(req(`/api/stores/${STORE_ID}/products`), ctx(STORE_ID));
    expect(await res.json()).toHaveLength(1);
  });
});

describe("POST /api/stores/:id/clear-needed", () => {
  it("→ 204", async () => {
    state.fake!.respond({ data: [{ id: PRODUCT_ID }] });
    const res = await clearNeededRoute.POST(req(`/api/stores/${STORE_ID}/clear-needed`, { method: "POST" }), ctx(STORE_ID));
    expect(res.status).toBe(204);
  });

  it("puuduva poe korral 404", async () => {
    state.fake!.respond({ data: [] }, { data: null });
    const res = await clearNeededRoute.POST(req(`/api/stores/${STORE_ID}/clear-needed`, { method: "POST" }), ctx(STORE_ID));
    expect(res.status).toBe(404);
  });

  it("teiselt saidilt → 403", async () => {
    const res = await clearNeededRoute.POST(
      req(`/api/stores/${STORE_ID}/clear-needed`, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
      ctx(STORE_ID),
    );
    expect(res.status).toBe(403);
  });
});

describe("/api/products/:id", () => {
  it("PATCH { needed } muudab märget", async () => {
    state.fake!.respond({ data: product({ is_needed: true }) });
    const res = await productRoute.PATCH(req(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: { needed: true } }), ctx(PRODUCT_ID));
    expect(res.status).toBe(200);
    expect((await res.json()).needed).toBe(true);
    expect(state.fake!.argsOf("update")).toEqual([[{ is_needed: true }]]);
  });

  it("PATCH { name } muudab nime", async () => {
    state.fake!.respond({ data: product({ name: "Uus" }) });
    const res = await productRoute.PATCH(req(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: { name: "Uus" } }), ctx(PRODUCT_ID));
    expect((await res.json()).name).toBe("Uus");
  });

  it("PATCH { name, needed } muudab mõlemat ÜHE päringuga", async () => {
    state.fake!.respond({ data: product({ name: "Uus", is_needed: true }) });
    const res = await productRoute.PATCH(
      req(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: { name: " Uus ", needed: true } }),
      ctx(PRODUCT_ID),
    );
    expect(await res.json()).toMatchObject({ name: "Uus", needed: true });
    expect(state.fake!.calls).toHaveLength(1);
    expect(state.fake!.argsOf("update")).toEqual([[{ name: "Uus", is_needed: true }]]);
  });

  it("PATCH vigase „needed“ korral ei muudeta ka nime (pole poolikut muudatust)", async () => {
    const res = await productRoute.PATCH(
      req(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: { name: "Uus", needed: "yes" } }),
      ctx(PRODUCT_ID),
    );
    expect(res.status).toBe(400);
    expect(state.fake!.calls).toHaveLength(0);
  });

  it("PATCH tühja kehaga → 400", async () => {
    const res = await productRoute.PATCH(req(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: {} }), ctx(PRODUCT_ID));
    expect(res.status).toBe(400);
  });

  it("DELETE → 204", async () => {
    state.fake!.respond({ data: [{ id: PRODUCT_ID, store_id: STORE_ID }] });
    const res = await productRoute.DELETE(req(`/api/products/${PRODUCT_ID}`, { method: "DELETE" }), ctx(PRODUCT_ID));
    expect(res.status).toBe(204);
  });

  it("DELETE olematu toote korral 404", async () => {
    state.fake!.respond({ data: [] });
    const res = await productRoute.DELETE(req(`/api/products/${PRODUCT_ID}`, { method: "DELETE" }), ctx(PRODUCT_ID));
    expect(res.status).toBe(404);
  });
});
