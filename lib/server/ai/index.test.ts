/** AI_PROVIDER: meta by default, google as the fallback, anything else refused. */
import { afterEach, describe, expect, it } from "vitest";
import { ai, aiProvider } from "./index";

const saved = process.env.AI_PROVIDER;
afterEach(() => {
  if (saved === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = saved;
});

describe("AI provider switch", () => {
  it("defaults to meta and accepts google", () => {
    expect(aiProvider(undefined)).toBe("meta");
    expect(aiProvider("")).toBe("meta");
    expect(aiProvider(" Google ")).toBe("google");
  });
  it("refuses an unknown provider", () => {
    expect(() => aiProvider("openai")).toThrow(/must be "google" or "meta"/);
  });
  it("gives the Gemini adapters, the local face counter and a skipped reviewer with google", async () => {
    process.env.AI_PROVIDER = "google";
    const s = ai();
    expect(s.provider).toBe("google");
    expect(s.imageGenerator.provider).toBe("google");
    expect(s.brandAgent.label).toBe("Gemini");
    const r = await s.reviewer.review({ bytes: new Uint8Array(), mime: "image/jpeg" }, { id: "s", prompt: "p", aspect: "1:1", rationale: "" }, {} as never);
    expect(r).toMatchObject({ verdict: "pass", skipped: true });
  });
  it("gives Muse Image, SAM 3.1 and the Muse Spark agent and reviewer with meta", async () => {
    process.env.AI_PROVIDER = "meta";
    const s = ai();
    expect(s.provider).toBe("meta");
    expect(s.imageGenerator.provider).toBe("meta");
    expect(s.brandAgent.label).toBe("Muse Spark");
    expect(s.brandAgent.configHint).toBe("MODEL_API_KEY");
    expect(s.segmenter).toBe((await import("./meta/sam")).samSegmenter);
  });
});

describe("aspects per provider", () => {
  it("each provider offers only the shapes it can make: meta 1:1, 3:2, 2:3; google 1:1, 16:9, 9:16; the fixture any", async () => {
    const { supportedAspects, assertAspect } = await import("./index");
    expect(supportedAspects("meta")).toEqual(["1:1", "3:2", "2:3"]);
    expect(supportedAspects("google")).toEqual(["1:1", "16:9", "9:16"]);
    expect(supportedAspects("fixture")).toEqual(["1:1", "3:2", "2:3", "16:9", "9:16"]);
    process.env.AI_PROVIDER = "meta";
    for (const a of ["1:1", "3:2", "2:3"] as const) expect(() => assertAspect(a)).not.toThrow();
    expect(() => assertAspect("16:9")).toThrow(expect.objectContaining({ code: "UNSUPPORTED_SIZE", status: 422 }));
    process.env.AI_PROVIDER = "google";
    expect(() => assertAspect("9:16")).not.toThrow();
    expect(() => assertAspect("3:2")).toThrow(expect.objectContaining({ code: "UNSUPPORTED_SIZE" }));
  });
});

