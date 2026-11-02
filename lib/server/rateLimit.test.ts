/** Per-request rate limits: fixed one-minute windows, Retry-After to the window's end. */
import { afterEach, describe, expect, it } from "vitest";
import { perMinute, RateLimited, rateDecision, windowKey } from "./rateLimit";

afterEach(() => {
  delete process.env.RATE_LIMIT_RENDER_PER_MIN;
});

describe("rate limits", () => {
  it("allows up to the limit in a window, then refuses with Retry-After to the window's end", () => {
    const now = 120_000 + 15_000; // 15 s into a minute
    expect(rateDecision(6, 6, now)).toEqual({ allowed: true, retryAfter: 45 });
    expect(rateDecision(7, 6, now)).toEqual({ allowed: false, retryAfter: 45 });
  });
  it("keys a window per route, user and minute", () => {
    expect(windowKey("render", "u1", 60_000)).toBe("render:u1:1");
    expect(windowKey("render", "u1", 119_999)).toBe("render:u1:1");
    expect(windowKey("render", "u1", 120_000)).toBe("render:u1:2");
    expect(windowKey("plan", "u1", 60_000)).not.toBe(windowKey("render", "u1", 60_000));
  });
  it("has defaults per route, configurable, ignoring bad values", () => {
    expect([perMinute("render"), perMinute("plan"), perMinute("reset")]).toEqual([6, 12, 3]);
    process.env.RATE_LIMIT_RENDER_PER_MIN = "2";
    expect(perMinute("render")).toBe(2);
    process.env.RATE_LIMIT_RENDER_PER_MIN = "lots";
    expect(perMinute("render")).toBe(6);
  });
  it("refuses with 429, RATE_LIMITED and the seconds to wait", () => {
    const e = new RateLimited("reset", 3, 20);
    expect(e).toMatchObject({ status: 429, code: "RATE_LIMITED", retryAfter: 20 });
    expect(e.message).toMatch(/at most 3 a minute/);
  });
});
