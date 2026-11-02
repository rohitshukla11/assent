/** --max-usd: every Meta call is priced before it is sent, and none is sent that could pass the cap. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { budgetFromArgs, budgetState, estimateBefore, setBudget } from "./budget";
import { metaPost, metaStream } from "./meta/client";

const spark = (text: string, extra: Record<string, unknown> = {}) => ({ model: "muse-spark-1.3", input: [{ content: [{ type: "input_text", text }] }], max_output_tokens: 4096, ...extra });

beforeEach(() => {
  process.env.MODEL_API_KEY = "test-key";
});
afterEach(() => {
  setBudget(null);
  vi.unstubAllGlobals();
  delete process.env.MODEL_API_KEY;
});

describe("estimates before a call", () => {
  it("prices images per image and Spark by its input and a 2,000-token output allowance", () => {
    expect(estimateBefore({ model: "muse-image-1.0" })).toBe(0.01);
    expect(estimateBefore({ model: "sam-3.1" })).toBe(0.0025);
    const text = estimateBefore(spark("x".repeat(4000)));
    expect(text).toBeGreaterThan((2000 * 4.25) / 1e6);
    expect(text).toBeLessThan(0.0125);
    const withImage = estimateBefore(spark("x", { input: [{ content: [{ type: "input_image", image_url: `data:image/png;base64,${"A".repeat(50_000)}` }] }] }));
    expect(withImage).toBeCloseTo(((2000 * 4.25) + (1500 + 30) * 1.25) / 1e6, 3);
  });
});

describe("the cap", () => {
  it("never sends a call that could pass it, and counts real usage after each call", async () => {
    setBudget(0.012);
    const ok = { model: "muse-spark-1.3", usage: { input_tokens: 600, output_tokens: 1000, input_tokens_details: { cached_tokens: 0 } } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ok), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await metaPost("/responses", spark("plan this"));
    expect(budgetState()!.spentUsd).toBeCloseTo((600 * 1.25 + 1000 * 4.25) / 1e6, 6);
    await expect(metaPost("/responses", { model: "muse-image-1.0" })).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("counts a refused request (HTTP 4xx) as nothing", async () => {
    setBudget(0.01);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "unknown value", code: "invalid_request_error" } }), { status: 400 })));
    await expect(metaPost("/responses", { model: "muse-image-1.0" })).rejects.toMatchObject({ httpStatus: 400 });
    expect(budgetState()).toMatchObject({ spentUsd: 0, calls: 1 });
  });
  it("covers streamed calls (SAM) too", async () => {
    setBudget(0.002);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(metaStream("/responses", { model: "sam-3.1" })).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("is required for paid runs, optional for free ones, and must be an amount", () => {
    expect(() => budgetFromArgs(["--yes"], true)).toThrow(/add --max-usd/);
    expect(budgetFromArgs([], false)).toBeNull();
    expect(budgetFromArgs(["--max-usd", "0.06"], true)).toBe(0.06);
    expect(() => budgetFromArgs(["--max-usd", "lots"], true)).toThrow(/needs an amount/);
  });
});

describe("a stop by the cap isn't a refusal or a block", () => {
  it("comes out of the policy check and the consent gate as itself", async () => {
    const { BudgetExceeded } = await import("./budget");
    const { checkPrompt } = await import("../filter");
    const { runConsentGate } = await import("../consentGate");
    const saved = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "meta";
    setBudget(0.0001);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(checkPrompt("The person holding a cup in a café", { use: "advertising" } as never)).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
      const segmenter = { detectPeople: async () => Promise.reject(new BudgetExceeded("cap")) };
      await expect(runConsentGate({ bytes: new Uint8Array([1]), mime: "image/jpeg" }, [new Float32Array(512)], segmenter as never)).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (saved === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = saved;
    }
  });
});

