import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv } from "@/lib/supabase/env";

afterEach(() => vi.unstubAllEnvs());

describe("getSupabaseEnv", () => {
  it("tagastab väärtused", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(getSupabaseEnv()).toEqual({ url: "https://abc.supabase.co", publicKey: "anon" });
  });

  it("eelistab uut publishable võtit", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(getSupabaseEnv().publicKey).toBe("sb_publishable_x");
  });

  it("keeldub salajasest võtmest avalikus muutujas", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_abc");
    expect(() => getSupabaseEnv()).toThrow(/sb_secret_/);
  });

  it("viskab selge vea, kui muutujad puuduvad", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("nõuab https-i (v.a localhost)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://abc.supabase.co");
    expect(() => getSupabaseEnv()).toThrow(/https/);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(getSupabaseEnv().url).toBe("http://127.0.0.1:54321");
  });

  it("keelab vigase URL-i", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    expect(() => getSupabaseEnv()).toThrow(/URL/);
  });
});
