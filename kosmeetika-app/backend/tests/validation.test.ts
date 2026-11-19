import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH, isUuid, validateBoolean, validateId, validateName } from "@/lib/data/validation";

describe("validateName", () => {
  it("eemaldab algus- ja lõputühikud", () => {
    expect(validateName("   Ripsmeliim  ", "product")).toEqual({ ok: true, value: "Ripsmeliim" });
  });

  it("säilitab tühikud nime sees", () => {
    expect(validateName(" Beauty  Shop ", "store")).toEqual({ ok: true, value: "Beauty  Shop" });
  });

  it.each(["", "   ", "\t ", " ", "　"])("keelab tühja nime %j", (value) => {
    const r = validateName(value, "store");
    expect(r).toEqual({ ok: false, code: "VALIDATION", error: "Poe nimi ei tohi olla tühi." });
  });

  it.each([undefined, null, 42, {}, [], true])("keelab mitte-teksti %j", (value) => {
    const r = validateName(value, "product");
    expect(r).toMatchObject({ ok: false, code: "VALIDATION", error: "Toote nimi ei tohi olla tühi." });
  });

  it("lubab täpselt maksimaalse pikkusega nime", () => {
    expect(validateName("a".repeat(MAX_NAME_LENGTH), "store").ok).toBe(true);
  });

  it("keelab liiga pika nime", () => {
    const r = validateName("a".repeat(MAX_NAME_LENGTH + 1), "store");
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    if (!r.ok) expect(r.error).toContain(String(MAX_NAME_LENGTH));
  });

  it("loeb emojid ühe märgina", () => {
    expect(validateName("💄".repeat(MAX_NAME_LENGTH), "product").ok).toBe(true);
  });

  it("lubab täpitähti ja erimärke", () => {
    expect(validateName("Šampoon & Õli – „Öko“", "product")).toEqual({ ok: true, value: "Šampoon & Õli – „Öko“" });
  });

  it.each(["Ripsme\nliim", "a\u0000b", "x\u007fy"])("keelab juhtmärgid %j", (value) => {
    expect(validateName(value, "product")).toMatchObject({
      ok: false,
      error: "Toote nimi sisaldab lubamatuid märke.",
    });
  });

  it("normaliseerib Unicode'i (NFC)", () => {
    const decomposed = "Õli"; // O + kombineeriv tilde
    const r = validateName(decomposed, "product");
    expect(r).toEqual({ ok: true, value: "Õli" });
  });
});

describe("validateId / isUuid", () => {
  it("tunneb ära korrektse UUID", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("muudab UUID väiketähtedeks", () => {
    expect(validateId("AAAAAAAA-1111-4111-8111-111111111111", "store")).toEqual({
      ok: true,
      value: "aaaaaaaa-1111-4111-8111-111111111111",
    });
  });

  it.each(["", "123", "not-a-uuid", "11111111-1111-4111-8111-11111111111", "1; drop table stores", null, 5])(
    "keelab vigase ID %j",
    (value) => {
      expect(validateId(value, "store")).toEqual({ ok: false, code: "VALIDATION", error: "Vigane poe ID." });
      expect(validateId(value, "product")).toEqual({ ok: false, code: "VALIDATION", error: "Vigane toote ID." });
    },
  );
});

describe("validateBoolean", () => {
  it.each([true, false])("lubab %s", (v) => {
    expect(validateBoolean(v)).toEqual({ ok: true, value: v });
  });

  it.each(["true", 1, 0, null, undefined])("keelab %j", (v) => {
    expect(validateBoolean(v)).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});
