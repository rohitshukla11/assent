/** The prompt filter: keyword rules, then the BrandAgent's model check; fail closed. The agent is mocked. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LicenceDoc } from "@/lib/model";
import type { BrandAgent } from "./ai/types";

const agent = { label: "Model", configHint: "KEY", policyConfigured: vi.fn(), checkPolicy: vi.fn(), planShots: vi.fn() };
vi.mock("./ai", () => ({ ai: () => ({ brandAgent: agent as unknown as BrandAgent }) }));
const { checkPrompt } = await import("./filter");

const licence = { use: "advertising" } as LicenceDoc;
const metrics = { provider: "google", model: "m", latencyMs: 1, cost: null };

beforeEach(() => {
  agent.policyConfigured.mockReset().mockReturnValue(true);
  agent.checkPolicy.mockReset();
});

describe("prompt filter", () => {
  it("passes a clean prompt the model accepts", async () => {
    agent.checkPolicy.mockResolvedValue({ banned: [], fitsCategory: true, reason: "", metrics });
    const r = await checkPrompt("Holding a ceramic cup in a sunlit café", licence);
    expect(r.allowed).toBe(true);
    expect(r.layers.map((l) => l.name)).toEqual(["Local banned-use rules", "Model LLM filter (m)"]);
  });
  it("refuses on the keyword rules even when the model would allow it", async () => {
    agent.checkPolicy.mockResolvedValue({ banned: [], fitsCategory: true, reason: "", metrics });
    const r = await checkPrompt("Topless beach shoot", licence);
    expect(r.allowed).toBe(false);
    expect(r.reasons[0]).toMatch(/banned use \(rules\)/);
  });
  it("refuses when the model says it's outside the licensed use", async () => {
    agent.checkPolicy.mockResolvedValue({ banned: [], fitsCategory: false, reason: "editorial, not advertising", metrics });
    const r = await checkPrompt("A news photo of the person", licence);
    expect(r.reasons).toEqual(["outside the licensed use (Advertising) — editorial, not advertising"]);
  });
  it("fails closed when the model check errors", async () => {
    agent.checkPolicy.mockRejectedValue(new Error("HTTP 503"));
    const r = await checkPrompt("Holding a cup", licence);
    expect(r.allowed).toBe(false);
    expect(r.reasons[0]).toMatch(/LLM filter failed, so the render is refused: HTTP 503/);
  });
  it("refuses when the model check isn't configured (no project, no key): fail closed under both providers", async () => {
    agent.policyConfigured.mockReturnValue(false);
    const r = await checkPrompt("Holding a cup", licence);
    expect(r.allowed).toBe(false);
    expect(r.reasons[0]).toMatch(/not configured \(KEY\), so the render is refused/);
  });
});
