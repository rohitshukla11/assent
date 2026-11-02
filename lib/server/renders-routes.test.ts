/**
 * /api/renders and /api/render/log: past renders, delivered or blocked, for the brand and the creator in
 * them only; development (fixture) renders never listed for them; admins can reopen any render's steps.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type Doc = Record<string, unknown>;
const db = new Map<string, Map<string, Doc>>();
const put = (c: string, d: Doc) => void (db.get(c) ?? db.set(c, new Map()).get(c)!).set(String(d.id), d);
const snap = (id: string, d: Doc | undefined) => ({ id, exists: !!d, data: () => d });
const fake = {
  collection: (c: string) => ({
    doc: (id: string) => ({ id, get: async () => snap(id, db.get(c)?.get(id)) }),
    where: (f: string, _op: "==", v: unknown) => ({
      limit: () => ({ get: async () => ({ docs: [...(db.get(c)?.values() ?? [])].filter((d) => d[f] === v).map((d) => snap(String(d.id), d)) }) }),
    }),
  }),
  getAll: async (...refs: { id: string; get: () => Promise<unknown> }[]) => Promise.all(refs.map((r) => r.get())),
};
let caller: { uid: string; email: string | null; emailVerified: boolean } | null = null;
vi.mock("@/lib/server/authn", () => ({ requireUser: async () => (caller ? caller : Promise.reject(new Error("sign in first"))) }));
vi.mock("@/lib/server/firebase-admin", () => ({ firestore: () => fake, adminAuth: () => ({}) }));
vi.mock("@/lib/server/storage", () => ({ putObject: async () => {}, deleteObject: async () => {}, getObject: async () => null, signedUrl: async () => "" }));
const renders = (await import("@/app/api/renders/route")).GET;
const log = (await import("@/app/api/render/log/route")).GET;

const as = (uid: string, email: string | null = null) => void (caller = { uid, email, emailVerified: !!email });
const get = async (f: typeof renders, url: string) => {
  const r = await f(new Request(`http://x${url}`, { headers: { authorization: "Bearer t" } }), { params: Promise.resolve({}) });
  return { status: r.status, body: await r.json() };
};
const base = { licenceId: "L1", brandId: "brand", creatorId: "maya", brief: "café shot", createdAt: 1 };
put("demo", { id: "judges", evalBrandUid: "eval-brand" });
put("licences", { id: "L1", creatorName: "Maya Okafor", brandName: "Brew & Co.", use: "advertising" });
put("renders", { ...base, id: "real", model: "muse-image-1.0", price: 200, createdAt: 3 });
put("renders", { ...base, id: "dev", model: "fixture:maya.jpg", fixture: true, price: 200, createdAt: 4 });
put("renders", { ...base, id: "other", brandId: "someone-else", model: "muse-image-1.0", createdAt: 5 });
put("blockedRenders", { ...base, id: "gate01", model: "muse-image-1.0", blockedBy: "consent", consent: { code: "MULTIPLE_PEOPLE", explanation: "2 people were found" }, createdAt: 2 });
put("blockedRenders", { ...base, id: "devBlocked", model: "fixture:two-people.jpg", blockedBy: "consent", consent: { code: "MULTIPLE_PEOPLE", explanation: "" } });
put("blockedRenders", { ...base, id: "devBlockedOld", model: "fixture:two-people.jpg", blockedBy: "consent", consent: { code: "MULTIPLE_PEOPLE", explanation: "" } }); // before the fixture flag
put("renders", { ...base, id: "evalFlagged", brandId: "eval-brand", model: "muse-image-1.0", evalRun: true, createdAt: 6 });
put("renders", { ...base, id: "evalOld", brandId: "eval-brand", model: "muse-image-1.0", createdAt: 7 }); // before the flag existed
put("blockedRenders", { ...base, id: "evalBlocked", brandId: "eval-brand", model: "muse-image-1.0", evalRun: true, blockedBy: "consent", consent: { code: "NO_PERSON", explanation: "" } });
put("renderLogs", { id: "gate01", brandId: "brand", creatorId: "maya", provider: "meta", status: "blocked", steps: [{ step: "consent", status: "blocked", figure: { width: 1, height: 1, people: [], verdict: { passed: false, code: "MULTIPLE_PEOPLE", text: "" } } }] });

afterEach(() => {
  caller = null;
  delete process.env.ADMIN_EMAILS;
});

describe("/api/renders", () => {
  it("gives the brand its delivered and blocked renders, never development ones or other brands'", async () => {
    as("brand");
    const { body } = await get(renders, "/api/renders");
    expect(body.asBrand.map((r: Doc) => r.id)).toEqual(["real"]);
    expect(body.blockedAsBrand).toEqual([{ id: "gate01", licenceId: "L1", createdAt: 2, brief: "café shot", blockedBy: "consent", code: "MULTIPLE_PEOPLE", explanation: "2 people were found", creatorName: "Maya Okafor", brandName: "Brew & Co.", use: "advertising" }]);
  });
  it("gives the creator the same renders of their likeness, development and eval-brand ones left out", async () => {
    as("maya");
    const { body } = await get(renders, "/api/renders");
    expect(body.asCreator.map((r: Doc) => r.id).sort()).toEqual(["other", "real"]);
    expect(body.blockedAsCreator.map((r: Doc) => r.id)).toEqual(["gate01"]);
  });
});

describe("/api/render/log?renderId=", () => {
  it("reopens a past render's steps and consent figure for the brand and the creator in it", async () => {
    for (const uid of ["brand", "maya"]) {
      as(uid);
      const { status, body } = await get(log, "/api/render/log?renderId=gate01");
      expect(status).toBe(200);
      expect(body.log.steps[0].figure.verdict.code).toBe("MULTIPLE_PEOPLE");
      expect(body.blocked).toEqual({ blockedBy: "consent", code: "MULTIPLE_PEOPLE", explanation: "2 people were found" });
    }
  });
  it("is a 404 for anyone else, and readable by admins", async () => {
    as("someone-else", "someone@example.com");
    expect((await get(log, "/api/render/log?renderId=gate01")).status).toBe(404);
    process.env.ADMIN_EMAILS = "owner@example.com";
    as("owner", "owner@example.com");
    expect((await get(log, "/api/render/log?renderId=gate01")).status).toBe(200);
  });
});

describe("/api/creator/decryptions", () => {
  it("shows older \"Evaluation render\" entries as \"Evaluation run (automated test)\", leaving the stored entry as it is", async () => {
    put("decryptions", { id: "d1", creatorId: "maya", licenceId: "L1", renderId: "r1", by: "render-service", label: "Evaluation render", at: 1 });
    put("decryptions", { id: "d2", creatorId: "maya", licenceId: "L1", renderId: "r2", by: "render-service", at: 2 });
    const { GET } = await import("@/app/api/creator/decryptions/route");
    as("maya");
    const { body } = await get(GET, "/api/creator/decryptions");
    expect(body.decryptions.map((d: Doc) => d.label ?? null)).toEqual([null, "Evaluation run (automated test)"]);
    expect(db.get("decryptions")!.get("d1")!.label).toBe("Evaluation render");
  });
});

