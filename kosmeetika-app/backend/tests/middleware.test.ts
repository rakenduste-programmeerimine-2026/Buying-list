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

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "Slackbot-LinkExpanding 1.0",
    "facebookexternalhit/1.1",
    "WhatsApp/2.23",
    "curl/8.0",
    "Mozilla/5.0 HeadlessChrome/120",
    "UptimeRobot/2.0",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5",
    "Mozilla/5.0 (compatible; Yahoo! Slurp)",
    "AdsBot-Google (+http://www.google.com/adsbot.html)",
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider)",
  ])("robot %s ei loo kasutajat", (ua) => {
    expect(shouldCreateAnonymousSession(req("/", { headers: { accept: "text/html", "user-agent": ua } }))).toBe(false);
  });

  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 Telegram-Android/10.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 discord/1.0.9 Chrome/120 Electron/28 Safari/537.36",
  ])("päris brauser loob kasutaja: %s", (ua) => {
    expect(shouldCreateAnonymousSession(req("/", { headers: { accept: "text/html", "user-agent": ua } }))).toBe(true);
  });

  it("auth callback ei loo anonüümset kasutajat", () => {
    expect(shouldCreateAnonymousSession(req("/auth/callback", { headers: { accept: "text/html" } }))).toBe(false);
  });
});
