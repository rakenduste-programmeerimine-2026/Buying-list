import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { shouldCreateAnonymousSession } from "@/lib/supabase/middleware";

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? "GET", headers: init.headers });

describe("shouldCreateAnonymousSession", () => {
  it("lehe avamisel (HTML) luuakse anonüümne sessioon", () => {
    expect(shouldCreateAnonymousSession(req("/", { headers: { accept: "text/html,application/xhtml+xml" } }))).toBe(true);
    expect(shouldCreateAnonymousSession(req("/stores/x", { headers: { accept: "text/html" } }))).toBe(true);
  });

  it("API-päringud ei loo kasutajaid (kaitse massilise loomise eest)", () => {
    expect(shouldCreateAnonymousSession(req("/api/stores", { headers: { accept: "text/html" } }))).toBe(false);
    expect(shouldCreateAnonymousSession(req("/api/stores", { method: "POST" }))).toBe(false);
  });

  it("ilma HTML accept päiseta (nt curl) ei looda", () => {
    expect(shouldCreateAnonymousSession(req("/", { headers: { accept: "*/*" } }))).toBe(false);
  });

  it("prefetch ja POST ei loo kasutajat", () => {
    expect(shouldCreateAnonymousSession(req("/", { headers: { accept: "text/html", "next-router-prefetch": "1" } }))).toBe(false);
    expect(shouldCreateAnonymousSession(req("/", { method: "POST", headers: { accept: "text/html" } }))).toBe(false);
  });

  it("auth callback ei loo anonüümset kasutajat", () => {
    expect(shouldCreateAnonymousSession(req("/auth/callback", { headers: { accept: "text/html" } }))).toBe(false);
  });
});
