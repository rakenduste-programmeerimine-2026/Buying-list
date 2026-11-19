import { beforeEach, describe, expect, it, vi } from "vitest";

const ssr = vi.hoisted(() => ({ createBrowserClient: vi.fn(() => ({ kind: "browser" })), createServerClient: vi.fn() }));
const cookieStore = vi.hoisted(() => ({
  getAll: vi.fn(() => [{ name: "sb-a", value: "1" }]),
  set: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ssr);
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
});

describe("lib/supabase/client", () => {
  it("loob brauseri kliendi avaliku võtmega", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    expect(createClient()).toEqual({ kind: "browser" });
    expect(ssr.createBrowserClient).toHaveBeenCalledWith("https://abc.supabase.co", "anon");
  });
});

describe("lib/supabase/server", () => {
  it("loob serveri kliendi, mis loeb ja kirjutab küpsiseid", async () => {
    ssr.createServerClient.mockImplementation((_url: string, _key: string, opts: unknown) => opts);
    const { createClient } = await import("@/lib/supabase/server");
    const opts = (await createClient()) as unknown as {
      cookies: { getAll(): unknown; setAll(c: { name: string; value: string; options: object }[]): void };
    };
    expect(opts.cookies.getAll()).toEqual([{ name: "sb-a", value: "1" }]);
    opts.cookies.setAll([{ name: "sb-b", value: "2", options: { path: "/" } }]);
    expect(cookieStore.set).toHaveBeenCalledWith("sb-b", "2", { path: "/" });
  });

  it("Server Componentis küpsiste kirjutamise viga ignoreeritakse", async () => {
    ssr.createServerClient.mockImplementation((_url: string, _key: string, opts: unknown) => opts);
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
    const { createClient } = await import("@/lib/supabase/server");
    const opts = (await createClient()) as unknown as { cookies: { setAll(c: unknown[]): void } };
    expect(() => opts.cookies.setAll([{ name: "x", value: "y", options: {} }])).not.toThrow();
  });
});
