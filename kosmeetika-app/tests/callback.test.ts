import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession: exchange } })),
}));

const { GET } = await import("@/app/auth/callback/route");
const get = (qs: string) => GET(new NextRequest(`http://localhost:3000/auth/callback${qs}`));

describe("GET /auth/callback", () => {
  it("vahetab koodi ja suunab `next` teele", async () => {
    exchange.mockResolvedValueOnce({ error: null });
    const res = await get("?code=abc&next=/stores/1");
    expect(exchange).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("http://localhost:3000/stores/1");
  });

  it("ei suuna välisele saidile (open redirect)", async () => {
    exchange.mockResolvedValueOnce({ error: null });
    const res = await get("?code=abc&next=//evil.example/x");
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("vigane kood → avaleht veaga", async () => {
    exchange.mockResolvedValueOnce({ error: { code: "bad_code" } });
    const res = await get("?code=bad");
    expect(res.headers.get("location")).toBe("http://localhost:3000/?auth_error=1");
  });

  it("koodita → avaleht veaga", async () => {
    const res = await get("");
    expect(res.headers.get("location")).toBe("http://localhost:3000/?auth_error=1");
  });
});
