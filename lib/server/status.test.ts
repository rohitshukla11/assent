/** /api/status: the overall result for everyone, each check's detail for admins only. */
import { afterEach, describe, expect, it, vi } from "vitest";

const checks = [
  { key: "firestore", name: "Firestore", ok: true, detail: 'database "likeness-meta" reachable' },
  { key: "kms", name: "Cloud KMS", ok: true, detail: "photos: encrypt/decrypt ok" },
];
let caller: { uid: string; email: string | null; emailVerified: boolean } | null = null;
vi.mock("@/lib/server/status", () => ({ statusChecks: async () => checks }));
vi.mock("@/lib/server/authn", () => ({ requireUser: async () => (caller ? caller : Promise.reject(new Error("sign in first"))) }));
const { GET } = await import("@/app/api/status/route");

const call = async (auth?: string) => (await GET(new Request("http://x/api/status", auth ? { headers: { authorization: auth } } : {}), { params: Promise.resolve({}) })).json();

afterEach(() => {
  caller = null;
  delete process.env.ADMIN_EMAILS;
});

describe("/api/status", () => {
  it("gives anonymous callers only the overall result", async () => {
    expect(await call()).toEqual({ service: "assent", ok: true });
  });
  it("gives a signed-in non-admin, or a bad token, only the overall result", async () => {
    caller = { uid: "u", email: "someone@example.com", emailVerified: true };
    expect(await call("Bearer t")).toEqual({ service: "assent", ok: true });
    caller = null;
    expect(await call("Bearer bad")).toEqual({ service: "assent", ok: true });
  });
  it("gives admins each check's detail", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    caller = { uid: "u", email: "owner@example.com", emailVerified: true };
    expect(await call("Bearer t")).toMatchObject({ ok: true, checks: [{ key: "firestore" }, { key: "kms" }] });
  });
  it("reports failed when any check fails", async () => {
    checks[1].ok = false;
    expect(await call()).toEqual({ service: "assent", ok: false });
    checks[1].ok = true;
  });
});

describe("the Meta Model API check", () => {
  it("reports the key configured from configuration alone, with no model call, and fails without it", async () => {
    vi.doUnmock("@/lib/server/status");
    const { metaApiStatus } = await vi.importActual<typeof import("@/lib/server/status")>("@/lib/server/status");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const saved = { p: process.env.AI_PROVIDER, k: process.env.MODEL_API_KEY };
    try {
      process.env.AI_PROVIDER = "meta";
      process.env.MODEL_API_KEY = "test-key";
      expect(metaApiStatus()).toMatch(/^key configured \(not called by this check\): muse-image-1\.0, muse-spark-1\.3, sam-3\.1$/);
      expect(metaApiStatus()).not.toMatch(/test-key/);
      delete process.env.MODEL_API_KEY;
      expect(() => metaApiStatus()).toThrow(/MODEL_API_KEY is not set \(Secret Manager: likeness-meta-model-api-key\)/);
      process.env.AI_PROVIDER = "google";
      expect(metaApiStatus()).toBe("not used (AI_PROVIDER=google)");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      for (const [k, v] of [["AI_PROVIDER", saved.p], ["MODEL_API_KEY", saved.k]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

