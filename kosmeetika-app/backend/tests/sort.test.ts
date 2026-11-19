import { describe, expect, it } from "vitest";
import { sortProducts, sortStores } from "@/lib/data/sort";
import { getProductsByStore } from "@/lib/data/products";
import { getStores } from "@/lib/data/stores";
import { createFakeSupabase, product, store } from "./helpers/fakeSupabase";

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("eesti tähestik", () => {
  it("õ, ä, ö, ü on pärast w-d (mitte o/a/u juures)", () => {
    const rows = ["ülo", "Õli", "Ärkamine", "Wella", "Apotheka", "Öko", "Zeta", "Toode"].map((name) => store({ name }));
    expect(names(sortStores(rows))).toEqual(["Apotheka", "Zeta", "Toode", "Wella", "Õli", "Ärkamine", "Öko", "ülo"]);
  });

  it("suur- ja väiketähed ei mõjuta järjekorda", () => {
    expect(names(sortStores([store({ name: "beauty" }), store({ name: "Apotheka" }), store({ name: "Douglas" })]))).toEqual([
      "Apotheka",
      "beauty",
      "Douglas",
    ]);
  });

  it("numbrid loomulikus järjekorras", () => {
    expect(names(sortStores([store({ name: "Pood 10" }), store({ name: "Pood 2" })]))).toEqual(["Pood 2", "Pood 10"]);
  });

  it("sama nime korral vanem enne", () => {
    const a = store({ name: "X", created_at: "2026-01-02T00:00:00Z", id: "b" });
    const b = store({ name: "x", created_at: "2026-01-01T00:00:00Z", id: "a" });
    expect(sortStores([a, b]).map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("ei muuda algset massiivi", () => {
    const rows = [store({ name: "B" }), store({ name: "A" })];
    sortStores(rows);
    expect(names(rows)).toEqual(["B", "A"]);
  });
});

describe("sortProducts", () => {
  it("„vaja juurde“ eespool, mõlemad grupid tähestiku järgi", () => {
    const rows = [
      product({ name: "Õli", is_needed: false }),
      product({ name: "Vatipadjad", is_needed: true }),
      product({ name: "atsetoon", is_needed: false }),
      product({ name: "Ärkamisseerum", is_needed: true }),
      product({ name: "Küünelakk", is_needed: true }),
    ];
    expect(sortProducts(rows).map((p) => `${p.is_needed ? "*" : ""}${p.name}`)).toEqual([
      "*Küünelakk",
      "*Vatipadjad",
      "*Ärkamisseerum",
      "atsetoon",
      "Õli",
    ]);
  });
});

describe("andmefunktsioonid kasutavad eesti järjestust", () => {
  it("getStores parandab andmebaasi järjekorra", async () => {
    const fake = createFakeSupabase();
    // en_US collation tagastaks Õ O juures:
    fake.respond({ data: [store({ name: "Apotheka" }), store({ name: "Õnne pood" }), store({ name: "Pood" })] });
    const r = await getStores(fake.db);
    expect(r.ok && names(r.data)).toEqual(["Apotheka", "Pood", "Õnne pood"]);
  });

  it("getProductsByStore", async () => {
    const fake = createFakeSupabase();
    fake.respond({ data: [product({ name: "Öli" }), product({ name: "Pintsel" }), product({ name: "Ühekordsed kindad", is_needed: true })] });
    const r = await getProductsByStore(fake.db, store().id);
    expect(r.ok && names(r.data)).toEqual(["Ühekordsed kindad", "Pintsel", "Öli"]);
  });
});
