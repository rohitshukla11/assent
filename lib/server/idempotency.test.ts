/** Idempotent render requests: the same request id never generates or charges twice. */
import { describe, expect, it } from "vitest";
import { claimDecision, fingerprintOf, renderIdFor, STALE_MS, type RenderRequestDoc } from "./idempotency";

const fp = fingerprintOf({ licenceId: "L", brief: "café shot", aspectRatio: "1:1" });
const prior = (o: Partial<RenderRequestDoc>): RenderRequestDoc => ({ brandId: "b", fingerprint: fp, state: "running", createdAt: 1000, updatedAt: 1000, ...o });

describe("idempotent render requests", () => {
  it("derives a stable render id per brand and request id", () => {
    const id = renderIdFor("b", "0b4c8a3e-1f2d-4c5b-9a7e-123456789abc");
    expect(id).toBe(renderIdFor("b", "0b4c8a3e-1f2d-4c5b-9a7e-123456789abc"));
    expect(id).not.toBe(renderIdFor("other-brand", "0b4c8a3e-1f2d-4c5b-9a7e-123456789abc"));
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(() => renderIdFor("b", "short")).toThrow(/bad requestId/);
    expect(() => renderIdFor("b", "has spaces in it")).toThrow(/bad requestId/);
  });
  it("runs a new request", () => {
    expect(claimDecision(undefined, "b", fp)).toEqual({ kind: "run" });
  });
  it("replays a finished request without running it again", () => {
    expect(claimDecision(prior({ state: "done", result: { render: { id: "r" } } }), "b", fp)).toEqual({ kind: "replay", result: { render: { id: "r" } } });
  });
  it("returns the same refusal for a failed request", () => {
    expect(claimDecision(prior({ state: "failed", error: { status: 422, message: "image blocked by the consent gate (FACE_MISMATCH)", code: "FACE_MISMATCH" } }), "b", fp)).toEqual({
      kind: "refuse", status: 422, message: "image blocked by the consent gate (FACE_MISMATCH)", code: "FACE_MISMATCH",
    });
  });
  it("lets a request that hit a server error (5xx) run again", () => {
    expect(claimDecision(prior({ state: "failed", error: { status: 503, message: "Meta /responses: HTTP 503" } }), "b", fp)).toEqual({ kind: "run" });
  });
  it("refuses a duplicate while the first is still running, and lets a stale one be taken over", () => {
    expect(claimDecision(prior({}), "b", fp, 1000 + 5_000)).toMatchObject({ kind: "refuse", status: 409 });
    expect(claimDecision(prior({}), "b", fp, 1000 + STALE_MS)).toEqual({ kind: "run" });
  });
  it("refuses the same request id for a different render or another brand", () => {
    const other = fingerprintOf({ licenceId: "L", brief: "studio shot", aspectRatio: "1:1" });
    expect(claimDecision(prior({}), "b", other)).toMatchObject({ kind: "refuse", status: 409, message: expect.stringMatching(/different render/) });
    expect(claimDecision(prior({}), "x", fp)).toMatchObject({ kind: "refuse", status: 409 });
  });
});
