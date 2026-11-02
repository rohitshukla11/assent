/** Every reason code the server can send has plain language and a next step; judges get "Reset demo". */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REASONS, reasonFor } from "./reasons";

/** Reason codes in the server source: RenderRefused/HttpError codes, `code: "X"`, and the RefusalCode/ConsentCode unions. */
function serverCodes(): Set<string> {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) files.push(p);
    }
  };
  walk("lib/server");
  walk("app/api");
  const codes = new Set<string>();
  const add = (re: RegExp, s: string) => {
    for (const m of s.matchAll(re)) codes.add(m[1]);
  };
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    add(/(?:undefined|HttpError\(\d+, [^)]*?), "([A-Z][A-Z_]{3,})"\)/g, s);
    add(/code: "([A-Z][A-Z_]{3,})"/g, s);
    add(/\?\? "([A-Z][A-Z_]{3,})"/g, s);
    for (const u of s.matchAll(/export type (?:RefusalCode|ConsentCode) =([^;]+);/g)) add(/"([A-Z][A-Z_]{3,})"/g, u[1]);
  }
  for (const k of ["MODEL_API_KEY", "GOOGLE_CLOUD_PROJECT", "INVALID_MODEL_OUTPUT", "NO_MODEL_OUTPUT"]) codes.delete(k); // config names; Spark codes travel inside messages
  return codes;
}

describe("reason codes", () => {
  it("covers every code the server sends", () => {
    const codes = serverCodes();
    expect(codes.size).toBeGreaterThan(15);
    const missing = [...codes].filter((c) => !(c in REASONS));
    expect(missing).toEqual([]);
  });
  it("gives every reason a title and a next step", () => {
    for (const [code, r] of Object.entries(REASONS)) {
      expect(r.title.length, code).toBeGreaterThan(3);
      const n = r.next({ role: "brand", judge: false });
      expect(n.text.length, code).toBeGreaterThan(10);
    }
  });
  it("tells judges to press Reset demo where it helps, and other brands what they can do", () => {
    expect(reasonFor("LICENCE_REVOKED").next({ role: "brand", judge: false })).toMatchObject({ action: "find-creator", text: expect.stringMatching(/re-approve/) });
    expect(reasonFor("LICENCE_REVOKED").next({ role: "brand", judge: true })).toMatchObject({ action: "reset-demo" });
    expect(reasonFor("OVER_CAP").next({ role: "brand", judge: true })).toMatchObject({ action: "reset-demo", text: expect.stringMatching(/Reset demo/) });
    expect(reasonFor("NO_CREDITS").next({ role: "brand", judge: false }).action).toBe("top-up");
  });
  it("falls back on the HTTP status when there is no code", () => {
    expect(reasonFor(null, 429).code).toBe("RATE_LIMITED");
    expect(reasonFor(undefined, 504).code).toBe("TIMEOUT");
    expect(reasonFor("not_configured", 503).code).toBe("SERVICE_UNAVAILABLE");
    expect(reasonFor(null, 500).code).toBe("UNKNOWN");
  });
});

describe("the error card's wording", () => {
  it("says \"Nothing was charged.\" once, in the reason sentence, never in what you can do", async () => {
    const { REASONS, reasonSentence, blockedSentence } = await import("./reasons");
    for (const code of Object.keys(REASONS)) expect(reasonFor(code).next({ role: "brand", judge: false }).text, code).not.toMatch(/nothing was charged/i);
    const live = blockedSentence("consent", "2 people were found; a licensed image may show only the creator.");
    expect(live).toBe("Image blocked by the consent gate: 2 people were found; a licensed image may show only the creator.");
    expect(reasonSentence(live, !!REASONS.MULTIPLE_PEOPLE.uncharged)).toBe(`${live} Nothing was charged.`);
    expect(reasonFor("MULTIPLE_PEOPLE").next({ role: "brand", judge: false }).text).toBe("Remove other people from the brief and try again.");
    expect(reasonSentence("render refused: the licence became revoked during the render; nothing was charged", true)).toBe("render refused: the licence became revoked during the render; nothing was charged");
    expect(reasonSentence("Took too long", true)).toBe("Took too long. Nothing was charged.");
    expect(reasonSentence("", true)).toBe("Nothing was charged.");
    expect(reasonSentence("Licence revoked.", false)).toBe("Licence revoked.");
  });
  it("words a reopened blocked render as the live one", async () => {
    const { blockedSentence } = await import("./reasons");
    expect(blockedSentence("review", "Wrong product.")).toBe("Image blocked by the output review: Wrong product.");
    expect(blockedSentence("payment", "Refused at payment.")).toBe("Refused at payment.");
  });
});
