/** Judge mode: who may reset, what a reset changes, and the email/password check (fetch mocked). */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./gcp", () => ({ accessToken: async () => "token", requireProject: () => "p" }));
const { emailPasswordEnabled, isJudge, licenceResetPatch } = await import("./demo");

const registry = { brandUid: "meta-judge-brand", creatorUid: "meta-demo-maya-okafor", sourceCreatorUid: "demo-maya-okafor", licenceId: "L", licenceEnd: Date.UTC(2026, 10, 28), brandCredits: 2000, evalBrandUid: "meta-eval-brand", evalLicenceId: "E", seededAt: 1 };

afterEach(() => vi.unstubAllGlobals());

describe("judge mode", () => {
  it("only the judge brand and judge creator may reset; not the eval brand or anyone else", () => {
    expect(isJudge(registry, "meta-judge-brand")).toBe(true);
    expect(isJudge(registry, "meta-demo-maya-okafor")).toBe(true);
    expect(isJudge(registry, "meta-eval-brand")).toBe(false);
    expect(isJudge(registry, "someone")).toBe(false);
    expect(isJudge(null, "meta-judge-brand")).toBe(false);
  });
  it("a reset puts the render count back to 0, re-activates a revoked licence, and never shortens it", () => {
    expect(licenceResetPatch({ end: registry.licenceEnd, renderCount: 7, revokedAt: 123 }, registry)).toEqual({ renderCount: 0, end: registry.licenceEnd, revoked: true });
    const later = registry.licenceEnd + 86_400_000;
    expect(licenceResetPatch({ end: later, renderCount: 2 }, registry)).toEqual({ renderCount: 0, end: later, revoked: false });
    expect(licenceResetPatch({ end: registry.licenceEnd - 86_400_000, renderCount: 0 }, registry).end).toBe(registry.licenceEnd);
  });
  it("reads whether email/password sign-in is enabled, and says so plainly when it can't", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ signIn: { email: { enabled: false } } }))).mockResolvedValueOnce(new Response(JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await emailPasswordEnabled()).toBe(false);
    expect(await emailPasswordEnabled()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://identitytoolkit.googleapis.com/admin/v2/projects/p/config");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "PERMISSION_DENIED" } }), { status: 403 })));
    await expect(emailPasswordEnabled()).rejects.toThrow(/couldn't read the Firebase sign-in settings \(HTTP 403: PERMISSION_DENIED\)/);
  });
});

describe("judge brand daily limit", () => {
  const base = { siteRenders: 40, brandRenders: 3 };
  it("is 25 for the judge brand only; every other brand and the judge creator keep 3", async () => {
    const { dailyCapsFor } = await import("./demo");
    const { capRefusal } = await import("@/lib/model");
    expect(dailyCapsFor("meta-judge-brand", registry, base)).toEqual({ siteRenders: 40, brandRenders: 25 });
    for (const uid of ["some-brand", "meta-demo-maya-okafor"]) expect(dailyCapsFor(uid, registry, base)).toEqual(base);
    expect(dailyCapsFor("meta-judge-brand", null, base)).toEqual(base);
    const judge = dailyCapsFor("meta-judge-brand", registry, base);
    expect(capRefusal({ renders: 0 }, { renders: 24 }, judge)).toBeNull();
    expect(capRefusal({ renders: 0 }, { renders: 20, blocked: 5 }, judge)).toMatch(/today's 25 ads/);
    expect(capRefusal({ renders: 0 }, { renders: 3 }, dailyCapsFor("some-brand", registry, base))).toMatch(/today's 3 ads/);
  });
});

describe("eval brand daily limit", () => {
  const base = { siteRenders: 40, brandRenders: 3 };
  it("is 20 for the eval brand only (EVAL_BRAND_RENDERS_PER_DAY); the judge brand keeps 25, others 3; the site cap still applies", async () => {
    const { dailyCapsFor } = await import("./demo");
    const { capRefusal } = await import("@/lib/model");
    const ev = dailyCapsFor("meta-eval-brand", registry, base);
    expect(ev).toEqual({ siteRenders: 40, brandRenders: 20 });
    expect(dailyCapsFor("meta-judge-brand", registry, base).brandRenders).toBe(25);
    expect(dailyCapsFor("some-brand", registry, base)).toEqual(base);
    expect(dailyCapsFor("meta-eval-brand", null, base)).toEqual(base);
    expect(capRefusal({ renders: 0 }, { renders: 19 }, ev)).toBeNull();
    expect(capRefusal({ renders: 0 }, { renders: 15, blocked: 5 }, ev)).toMatch(/today's 20 ads/);
    expect(capRefusal({ renders: 40 }, { renders: 0 }, ev)).not.toBeNull();
    process.env.EVAL_BRAND_RENDERS_PER_DAY = "5";
    try {
      expect(dailyCapsFor("meta-eval-brand", registry, base).brandRenders).toBe(5);
    } finally {
      delete process.env.EVAL_BRAND_RENDERS_PER_DAY;
    }
  });
});
