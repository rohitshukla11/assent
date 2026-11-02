/**
 * /api/licences and /api/licences/{id}/revoke: the eval brand's licence (automated test runs) is left out of
 * the creator's lists, so out of "Active licences" too, and the creator can't revoke it; the eval brand still
 * sees its own licence, and every other licence is listed and revoked as before.
 */
import { describe, expect, it, vi } from "vitest";

type Doc = Record<string, unknown>;
const db = new Map<string, Map<string, Doc>>();
const coll = (c: string) => db.get(c) ?? db.set(c, new Map()).get(c)!;
const put = (c: string, d: Doc) => void coll(c).set(String(d.id), d);
const snap = (id: string, d: Doc | undefined) => ({ id, exists: !!d, data: () => d });
let autoId = 0;
const ref = (c: string, id = `auto${++autoId}`) => ({ id, c, get: async () => snap(id, coll(c).get(id)) });
type Ref = ReturnType<typeof ref>;
const fake = {
  collection: (c: string) => ({
    doc: (id?: string) => ref(c, id),
    where: (f: string, _op: "==", v: unknown) => ({
      limit: () => ({ get: async () => ({ docs: [...coll(c).values()].filter((d) => d[f] === v).map((d) => snap(String(d.id), d)) }) }),
    }),
  }),
  runTransaction: async <T,>(f: (tx: unknown) => Promise<T>) =>
    f({
      get: (r: Ref) => r.get(),
      update: (r: Ref, patch: Doc) => void coll(r.c).set(r.id, { ...coll(r.c).get(r.id), ...patch }),
      create: (r: Ref, d: Doc) => void coll(r.c).set(r.id, { id: r.id, ...d }),
    }),
};
let caller = { uid: "", email: null as string | null, emailVerified: false };
vi.mock("@/lib/server/authn", () => ({ requireUser: async () => caller }));
vi.mock("@/lib/server/firebase-admin", () => ({ firestore: () => fake, adminAuth: () => ({}) }));
const list = (await import("@/app/api/licences/route")).GET;
const revokeRoute = (await import("@/app/api/licences/[id]/revoke/route")).POST;

const as = (uid: string) => void (caller = { uid, email: null, emailVerified: false });
type Route = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
const call = async (f: Route, url: string, params: Record<string, string> = {}, method = "GET") => {
  const r = await f(new Request(`http://x${url}`, { method, headers: { authorization: "Bearer t" } }), { params: Promise.resolve(params) as Promise<never> });
  return { status: r.status, body: await r.json() };
};
const licence = (id: string, brandId: string) => ({ id, creatorId: "maya", brandId, creatorName: "Maya Okafor", brandName: brandId, use: "advertising", start: 0, end: Date.now() + 86_400_000, maxRenders: 10, renderCount: 0, createdAt: 1 });
put("demo", { id: "judges", brandUid: "judge-brand", creatorUid: "maya", evalBrandUid: "eval-brand", evalLicenceId: "evalLicence" });
put("licences", licence("judgeLicence", "judge-brand"));
put("licences", licence("evalLicence", "eval-brand"));
put("requests", { id: "evalRequest", creatorId: "maya", brandId: "eval-brand", state: "approved", createdAt: 1 });
put("requests", { id: "judgeRequest", creatorId: "maya", brandId: "judge-brand", state: "approved", createdAt: 1 });

describe("the eval licence", () => {
  it("is left out of the creator's licences and requests (so out of Active licences)", async () => {
    as("maya");
    const { body } = await call(list, "/api/licences");
    expect(body.asCreator.licences.map((l: Doc) => l.id)).toEqual(["judgeLicence"]);
    expect(body.asCreator.requests.map((r: Doc) => r.id)).toEqual(["judgeRequest"]);
    expect(body.asCreator.licences.filter((l: Doc) => l.status === "Active")).toHaveLength(1);
  });

  it("is still listed for the eval brand itself", async () => {
    as("eval-brand");
    const { body } = await call(list, "/api/licences");
    expect(body.asBrand.licences.map((l: Doc) => l.id)).toEqual(["evalLicence"]);
  });

  it("can't be revoked by the judge creator account; the judge licence can", async () => {
    as("maya");
    const refused = await call(revokeRoute, "/api/licences/evalLicence/revoke", { id: "evalLicence" }, "POST");
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe("EVAL_LICENCE");
    expect(coll("licences").get("evalLicence")!.revokedAt).toBeUndefined();
    expect([...coll("revocations").values()]).toHaveLength(0);

    const ok = await call(revokeRoute, "/api/licences/judgeLicence/revoke", { id: "judgeLicence" }, "POST");
    expect(ok.status).toBe(200);
    expect(coll("licences").get("judgeLicence")!.revokedAt).toEqual(expect.any(Number));
  });
});
