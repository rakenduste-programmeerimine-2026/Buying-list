import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieOpts = {
  cookies: {
    getAll(): unknown;
    setAll(c: { name: string; value: string; options: object }[], headers: Record<string, string>): void;
  };
};
const state = vi.hoisted(() => ({
  claims: null as { sub: string } | null,
  signIn: vi.fn(),
  opts: null as CookieOpts | null,
  throwOnClaims: false,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_u: string, _k: string, opts: CookieOpts) => {
    state.opts = opts;
    return {
      auth: {
        getClaims: async () => {
          if (state.throwOnClaims) throw new Error("network");
          return { data: state.claims ? { claims: state.claims } : null, error: null };
        },
        signInAnonymously: async () => {
          await state.signIn();
          // Supabase kirjutab uue sessiooni küpsistesse:
          state.opts!.cookies.setAll([{ name: "sb-test-auth-token", value: "tok", options: { path: "/" } }], {
            "Cache-Control": "private, no-store",
          });
          return { error: null };
        },
      },
    };
  }),
}));

const { updateSession } = await import("@/lib/supabase/middleware");
const page = (path = "/") => new NextRequest(`http://localhost:3000${path}`, { headers: { accept: "text/html" } });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  state.claims = null;
  state.throwOnClaims = false;
  state.signIn = vi.fn();
});

describe("updateSession", () => {
  it("uus seade lehe avamisel → anonüümne kasutaja + sessiooniküpsis + no-store", async () => {
    const res = await updateSession(page());
    expect(state.signIn).toHaveBeenCalledOnce();
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("tok");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("olemasoleva sessiooniga uut kasutajat ei looda", async () => {
    state.claims = { sub: "u1" };
    await updateSession(page());
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("API-päring ei loo kasutajat", async () => {
    await updateSession(new NextRequest("http://localhost:3000/api/stores"));
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("puuduva seadistuse korral lastakse päring läbi", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await updateSession(page());
    expect(res.status).toBe(200);
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("Auth serveri viga ei murra lehte", async () => {
    state.throwOnClaims = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await updateSession(page());
    expect(res.status).toBe(200);
  });

  it("küpsised loetakse päringust", async () => {
    state.claims = { sub: "u1" };
    const req = page();
    req.cookies.set("sb-x", "1");
    await updateSession(req);
    expect(state.opts!.cookies.getAll()).toEqual([{ name: "sb-x", value: "1" }]);
  });
});
