import { describe, expect, it, vi } from "vitest";
import {
  getCurrentUser,
  mapAuthError,
  safeRedirectPath,
  setPassword,
  signIn,
  signOut,
  signUp,
  upgradeAnonymousUser,
  validateEmail,
  validatePassword,
} from "@/lib/data/auth";
import { createFakeSupabase } from "./helpers/fakeSupabase";

type AuthMock = Record<string, unknown> & { user: Record<string, unknown> | null };
const authOf = (fake: ReturnType<typeof createFakeSupabase>) => fake.auth as unknown as AuthMock;

describe("validateEmail / validatePassword", () => {
  it("puhastab ja muudab e-posti väiketähtedeks", () => {
    expect(validateEmail("  Maik@Example.COM ")).toEqual({ ok: true, value: "maik@example.com" });
  });
  it.each(["", "   ", "maik", "maik@", "@x.ee", "a b@x.ee", null, 1])("keelab %j", (v) => {
    expect(validateEmail(v)).toMatchObject({ ok: false, code: "VALIDATION" });
  });
  it("parool vähemalt 8 märki", () => {
    expect(validatePassword("1234567").ok).toBe(false);
    expect(validatePassword("12345678").ok).toBe(true);
  });
  it("parool kuni 72 baiti", () => {
    expect(validatePassword("a".repeat(72)).ok).toBe(true);
    expect(validatePassword("a".repeat(73)).ok).toBe(false);
    expect(validatePassword("õ".repeat(40)).ok).toBe(false); // 80 baiti
  });
});

describe("mapAuthError", () => {
  it.each([
    ["invalid_credentials", "UNAUTHORIZED", "Vale e-post või parool."],
    ["user_already_exists", "CONFLICT", "Selle e-postiga konto on juba olemas."],
    ["over_request_rate_limit", "FORBIDDEN", "Liiga palju katseid. Proovi mõne minuti pärast uuesti."],
    ["anonymous_provider_disabled", "CONFIG", "Anonüümne sisselogimine on Supabase'is välja lülitatud."],
    ["something_else", "UNKNOWN", "Sisselogimine ebaõnnestus. Proovi hiljem uuesti."],
  ])("%s", (code, expectedCode, message) => {
    expect(mapAuthError({ code, message: "internal" }, "t")).toEqual({ ok: false, code: expectedCode, error: message });
  });
});

describe("getCurrentUser", () => {
  it("tagastab anonüümse kasutaja", async () => {
    const fake = createFakeSupabase();
    expect(await getCurrentUser(fake.db)).toEqual({
      ok: true,
      data: { id: "44444444-4444-4444-8444-444444444444", email: null, isAnonymous: true },
    });
  });
  it("Auth server maas → viga, mitte „välja logitud“", async () => {
    const fake = createFakeSupabase();
    authOf(fake).getUser = async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 503 } });
    expect(await getCurrentUser(fake.db)).toMatchObject({ ok: false, code: "UNKNOWN" });
  });

  it("tagastab null, kui keegi pole sisse logitud", async () => {
    const fake = createFakeSupabase();
    fake.signOut();
    expect(await getCurrentUser(fake.db)).toEqual({ ok: true, data: null });
  });
});

describe("signUp", () => {
  it("loob konto ja annab teada, kas e-post vajab kinnitamist", async () => {
    const fake = createFakeSupabase();
    const mock = vi.fn(async () => ({ data: { user: { id: "u" }, session: null }, error: null }));
    authOf(fake).signUp = mock;

    const r = await signUp(fake.db, " A@B.ee ", "salasona1", "http://localhost:3000/auth/callback");

    expect(r).toEqual({ ok: true, data: { needsEmailConfirmation: true } });
    expect(mock).toHaveBeenCalledWith({
      email: "a@b.ee",
      password: "salasona1",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
  });

  it("ei kutsu Supabase'i lühikese parooliga", async () => {
    const fake = createFakeSupabase();
    const mock = vi.fn();
    authOf(fake).signUp = mock;
    expect(await signUp(fake.db, "a@b.ee", "123")).toMatchObject({ code: "VALIDATION" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("võrguvea korral selge teade", async () => {
    const fake = createFakeSupabase();
    authOf(fake).signUp = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    expect(await signUp(fake.db, "a@b.ee", "salasona1")).toMatchObject({ ok: false, code: "UNKNOWN" });
  });
});

describe("signIn / signOut", () => {
  it("vale parool → üldine teade (ei avalda, kas konto on olemas)", async () => {
    const fake = createFakeSupabase();
    authOf(fake).signInWithPassword = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    }));
    expect(await signIn(fake.db, "a@b.ee", "vale")).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      error: "Vale e-post või parool.",
    });
  });

  it("õnnestunud sisselogimine", async () => {
    const fake = createFakeSupabase();
    authOf(fake).signInWithPassword = vi.fn(async () => ({
      data: { user: { id: "u1", email: "a@b.ee" }, session: {} },
      error: null,
    }));
    expect(await signIn(fake.db, "a@b.ee", "salasona1")).toEqual({
      ok: true,
      data: { id: "u1", email: "a@b.ee", isAnonymous: false },
    });
  });

  it("tühi parool → VALIDATION", async () => {
    const fake = createFakeSupabase();
    expect(await signIn(fake.db, "a@b.ee", "")).toMatchObject({ code: "VALIDATION", error: "Sisesta parool." });
  });

  it("signOut", async () => {
    const fake = createFakeSupabase();
    authOf(fake).signOut = vi.fn(async () => ({ error: null }));
    expect(await signOut(fake.db)).toEqual({ ok: true, data: null });
  });
});

describe("upgradeAnonymousUser / setPassword", () => {
  it("seob anonüümse kasutaja e-postiga", async () => {
    const fake = createFakeSupabase();
    const mock = vi.fn(async () => ({ data: {}, error: null }));
    authOf(fake).updateUser = mock;
    expect(await upgradeAnonymousUser(fake.db, "a@b.ee")).toEqual({ ok: true, data: { confirmationSent: true } });
    expect(mock).toHaveBeenCalledWith({ email: "a@b.ee" }, undefined);
  });

  it("ei luba tavakasutajal uuesti siduda", async () => {
    const fake = createFakeSupabase();
    authOf(fake).user = { id: "u", is_anonymous: false };
    expect(await upgradeAnonymousUser(fake.db, "a@b.ee")).toMatchObject({ code: "CONFLICT" });
  });

  it("väljalogitud kasutaja → UNAUTHORIZED", async () => {
    const fake = createFakeSupabase();
    fake.signOut();
    expect(await upgradeAnonymousUser(fake.db, "a@b.ee")).toMatchObject({ code: "UNAUTHORIZED" });
    expect(await setPassword(fake.db, "salasona1")).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("setPassword nõuab e-postiga kontot", async () => {
    const fake = createFakeSupabase();
    expect(await setPassword(fake.db, "salasona1")).toMatchObject({ code: "VALIDATION" });
    authOf(fake).user = { id: "u", is_anonymous: false };
    authOf(fake).updateUser = vi.fn(async () => ({ data: {}, error: null }));
    expect(await setPassword(fake.db, "salasona1")).toEqual({ ok: true, data: null });
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/stores/abc", "/stores/abc"],
    ["/", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/x\nSet-Cookie: a=b", "/"],
    [null, "/"],
  ])("%j → %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
