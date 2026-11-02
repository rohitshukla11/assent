/** The admin view: who is an admin, and the totals per day and per provider. */
import { afterEach, describe, expect, it } from "vitest";
import { isAdmin, summarise } from "./admin";

afterEach(() => {
  delete process.env.ADMIN_UIDS;
  delete process.env.ADMIN_EMAILS;
});

describe("admin", () => {
  it("is nobody by default; listed uids, or listed emails only when verified", () => {
    expect(isAdmin({ uid: "u1", email: "a@x.com", emailVerified: true })).toBe(false);
    process.env.ADMIN_UIDS = "u1, u2";
    process.env.ADMIN_EMAILS = "Owner@X.com";
    expect(isAdmin({ uid: "u2", email: null, emailVerified: false })).toBe(true);
    expect(isAdmin({ uid: "u9", email: "owner@x.com", emailVerified: true })).toBe(true);
    expect(isAdmin({ uid: "u9", email: "owner@x.com", emailVerified: false })).toBe(false);
    expect(isAdmin({ uid: "meta-judge-brand", email: "judge-brand@example.com", emailVerified: true })).toBe(false);
  });

  it("totals renders, outcomes, estimated cost and mean latency per day and per provider", () => {
    const d1 = Date.UTC(2026, 10, 1, 10);
    const d2 = Date.UTC(2026, 10, 2, 10);
    const s = (cost: number | null) => [{ step: "generate" as const, status: "ok" as const, at: 0, ms: 1000, detail: "", costUsd: cost }];
    const t = summarise([
      { provider: "meta", status: "delivered", startedAt: d1, finishedAt: d1 + 20_000, steps: s(0.0127) },
      { provider: "meta", status: "blocked", startedAt: d1, finishedAt: d1 + 10_000, steps: s(0.0125) },
      { provider: "google", status: "refused", startedAt: d2, finishedAt: d2 + 1_000, steps: s(null) },
      { provider: "meta", status: "running", startedAt: d2, finishedAt: null, steps: [] },
    ]);
    expect(t.total).toMatchObject({ renders: 4, delivered: 1, blocked: 1, refused: 1, costUsd: 0.0252 });
    expect(t.byDay.map((x) => [x.key, x.renders, x.avgLatencyMs])).toEqual([["2026-11-02", 2, 1000], ["2026-11-01", 2, 15000]]);
    expect(t.byProvider.map((x) => [x.key, x.renders, x.costUsd])).toEqual([["google", 1, 0], ["meta", 3, 0.0252]]);
    expect(summarise([]).total.renders).toBe(0);
  });
});

describe("admin provider filter", () => {
  it("reads ?provider, defaulting to all", async () => {
    const { parseProvider } = await import("./admin");
    expect(["meta", "google", "fixture"].map(parseProvider)).toEqual(["meta", "google", "fixture"]);
    expect(parseProvider(null)).toBeNull();
    expect(parseProvider("all")).toBeNull();
    expect(parseProvider("openai")).toBeNull();
  });
  it("gives a blocked render its step log's provider, or one from its model", async () => {
    const { blockedProvider } = await import("./admin");
    expect(blockedProvider({ model: "muse-image-1.0" }, "meta")).toBe("meta");
    expect(blockedProvider({ model: "fixture:two-people.jpg" }, undefined)).toBe("fixture");
    expect(blockedProvider({ model: "x", fixture: true }, undefined)).toBe("fixture");
    expect(blockedProvider({ model: "muse-image-1.0" }, undefined)).toBe("meta");
    expect(blockedProvider({ model: "gemini-2.5-flash-image" }, undefined)).toBe("google");
  });
});
