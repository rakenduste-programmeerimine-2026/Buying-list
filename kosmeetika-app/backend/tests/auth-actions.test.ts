import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fakeSupabase";

const state = vi.hoisted(() => ({ fake: null as ReturnType<typeof createFakeSupabase> | null, fail: false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    if (state.fail) throw new Error("Supabase'i seadistus puudub: test");
    return state.fake!.db;
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const actions = await import("@/lib/actions/auth");
type AuthMock = Record<string, unknown> & { user: Record<string, unknown> | null };
const auth = () => state.fake!.auth as unknown as AuthMock;

beforeEach(() => {
  state.fake = createFakeSupabase();
  state.fail = false;
  vi.mocked(revalidatePath).mockClear();
  vi.unstubAllEnvs();
});

describe("auth actions", () => {
  it("getCurrentUser", async () => {
    expect(await actions.getCurrentUser()).toMatchObject({ ok: true, data: { isAnonymous: true } });
  });

  it("puuduva seadistuse korral CONFIG", async () => {
    state.fail = true;
    for (const r of [
      await actions.getCurrentUser(),
      await actions.signUp("a@b.ee", "salasona1"),
      await actions.signIn("a@b.ee", "salasona1"),
      await actions.signOut(),
      await actions.upgradeAnonymousUser("a@b.ee"),
      await actions.setPassword("salasona1"),
    ]) {
      expect(r).toMatchObject({ ok: false, code: "CONFIG" });
    }
  });

  it("signUp kasutab NEXT_PUBLIC_SITE_URL põhjal callback'i (mitte Host päist)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kosmeetik.example");
    const signUp = vi.fn(async () => ({ data: { session: {} }, error: null }));
    auth().signUp = signUp;
    expect(await actions.signUp("a@b.ee", "salasona1")).toEqual({ ok: true, data: { needsEmailConfirmation: false } });
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { emailRedirectTo: "https://kosmeetik.example/auth/callback" } }),
    );
  });

  it("vigane NEXT_PUBLIC_SITE_URL → Supabase'i vaikimisi aadress", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    const signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
    auth().signUp = signUp;
    await actions.signUp("a@b.ee", "salasona1");
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: undefined }));
  });

  it("signIn ja signOut värskendavad vahemälu", async () => {
    auth().signInWithPassword = vi.fn(async () => ({ data: { user: { id: "u", email: "a@b.ee" } }, error: null }));
    auth().signOut = vi.fn(async () => ({ error: null }));
    expect((await actions.signIn("a@b.ee", "salasona1")).ok).toBe(true);
    expect((await actions.signOut()).ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("upgradeAnonymousUser ja setPassword", async () => {
    auth().updateUser = vi.fn(async () => ({ data: {}, error: null }));
    expect(await actions.upgradeAnonymousUser("a@b.ee")).toEqual({ ok: true, data: { confirmationSent: true } });
    auth().user = { id: "u", is_anonymous: false };
    expect(await actions.setPassword("salasona1")).toEqual({ ok: true, data: null });
  });

  it("Supabase'i vead teisendatakse", async () => {
    auth().signOut = vi.fn(async () => ({ error: { code: "session_not_found" } }));
    expect(await actions.signOut()).toMatchObject({ code: "UNAUTHORIZED" });
    auth().updateUser = vi.fn(async () => ({ data: {}, error: { code: "email_exists" } }));
    expect(await actions.upgradeAnonymousUser("a@b.ee")).toMatchObject({ code: "CONFLICT" });
    auth().user = { id: "u", is_anonymous: false };
    auth().updateUser = vi.fn(async () => ({ data: {}, error: { code: "weak_password" } }));
    expect(await actions.setPassword("salasona1")).toMatchObject({ code: "VALIDATION" });
  });
});
