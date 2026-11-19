import { describe, expect, it } from "vitest";
import { mapDbError, mapUnexpected } from "@/lib/data/errors";

describe("mapDbError", () => {
  it.each([
    ["PGRST116", "NOT_FOUND"],
    ["23503", "NOT_FOUND"],
    ["23505", "CONFLICT"],
    ["22P02", "VALIDATION"],
    ["23502", "VALIDATION"],
    ["23514", "VALIDATION"],
    ["22001", "VALIDATION"],
    ["42501", "FORBIDDEN"],
    ["PGRST301", "FORBIDDEN"],
    ["XX000", "UNKNOWN"],
    [undefined, "UNKNOWN"],
  ])("%s → %s", (code, expected) => {
    expect(mapDbError({ code, message: "secret sql detail" }, "store", "test").code).toBe(expected);
  });

  it("ei leki kunagi andmebaasi teadet kasutajale", () => {
    for (const code of ["XX000", "42501", "23505", "22P02"]) {
      expect(mapDbError({ code, message: "secret sql detail" }, "product", "t").error).not.toContain("secret");
    }
  });
});

describe("mapUnexpected", () => {
  it("tunneb ära puuduva seadistuse", () => {
    const err = new Error("Supabase'i seadistus puudub: lisa .env.local ...");
    expect(mapUnexpected(err, "t")).toEqual({
      ok: false,
      code: "CONFIG",
      error: "Andmebaasi ühendus ei ole seadistatud.",
    });
  });

  it("muu viga → UNKNOWN", () => {
    expect(mapUnexpected(new TypeError("fetch failed"), "t").code).toBe("UNKNOWN");
  });
});
