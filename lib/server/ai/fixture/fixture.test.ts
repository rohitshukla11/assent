/** AI_PROVIDER=fixture: development only, cost 0, refused in production and by the deploy script. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { ai, aiProvider } from "../index";
import { fixtureImageGenerator } from "./image";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
const setEnv = (k: string, v: string | undefined) => {
  if (v === undefined) delete process.env[k];
  else (process.env as Record<string, string>)[k] = v;
};

describe("fixture provider", () => {
  it("is allowed in development and refused in production", () => {
    expect(aiProvider("fixture")).toBe("fixture");
    setEnv("NODE_ENV", "production");
    expect(() => aiProvider("fixture")).toThrow(/development only/);
  });

  it("returns the stored image at cost 0, marked fixture", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fixture-"));
    const file = path.join(dir, "maya.jpg");
    writeFileSync(file, await sharp({ create: { width: 16, height: 16, channels: 3, background: "#888" } }).jpeg().toBuffer());
    setEnv("FIXTURE_IMAGE_PATH", file);
    setEnv("AI_PROVIDER", "fixture");
    expect(ai().imageGenerator).toBe(fixtureImageGenerator);
    const out = await fixtureImageGenerator.edit([], "anything", { quality: "full", licenceId: "L", renderIndex: 0 });
    expect(out.mime).toBe("image/jpeg");
    expect(out.metrics).toMatchObject({ provider: "fixture", model: "fixture:maya.jpg", cost: { costUsd: 0 } });
  });

  it("uses several stored images in turn, one per render", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fixture-"));
    const [a, b] = [path.join(dir, "maya.jpg"), path.join(dir, "two-people.png")];
    writeFileSync(a, await sharp({ create: { width: 16, height: 16, channels: 3, background: "#888" } }).jpeg().toBuffer());
    writeFileSync(b, await sharp({ create: { width: 16, height: 16, channels: 3, background: "#888" } }).png().toBuffer());
    setEnv("FIXTURE_IMAGE_PATH", `${a}, ${b}`);
    const names = [];
    for (let i = 0; i < 4; i++) names.push((await fixtureImageGenerator.edit([], "x", { quality: "full", licenceId: "L", renderIndex: 0 })).metrics.model);
    const first = names.indexOf("fixture:maya.jpg");
    expect(names.slice(first, first + 2)).toEqual(["fixture:maya.jpg", "fixture:two-people.png"]);
    expect(new Set(names)).toEqual(new Set(["fixture:maya.jpg", "fixture:two-people.png"]));
  });

  it("needs FIXTURE_IMAGE_PATH", async () => {
    setEnv("FIXTURE_IMAGE_PATH", undefined);
    await expect(fixtureImageGenerator.edit([], "x", { quality: "full", licenceId: "L", renderIndex: 0 })).rejects.toThrow(/FIXTURE_IMAGE_PATH/);
  });

  it("the deploy script refuses it before running anything", () => {
    const r = spawnSync("sh", ["scripts/deploy-gcp.sh", "some-project"], { env: { ...process.env, AI_PROVIDER: "fixture", GCLOUD: "false" }, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/refusing to deploy with AI_PROVIDER=fixture/);
  });
});

describe("deploying with meta", () => {
  it("refuses, before building anything, when the Meta key's secret doesn't exist (and never reads its value)", () => {
    const r = spawnSync("sh", ["scripts/deploy-gcp.sh", "some-project"], { env: { ...process.env, AI_PROVIDER: "meta", GCLOUD: "false" }, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/needs the Secret Manager secret likeness-meta-model-api-key/);
    expect(readFileSync("scripts/deploy-gcp.sh", "utf8")).not.toMatch(/secrets versions access/);
  });
});

describe("the deploy target", () => {
  it("is the service \"assent\" by default, and refuses likeness-ai's services by name", () => {
    expect(readFileSync("scripts/deploy-gcp.sh", "utf8")).toMatch(/^SERVICE="\$\{SERVICE:-assent\}"$/m);
    for (const name of ["likeness", "likeness-ai"]) {
      const r = spawnSync("sh", ["scripts/deploy-gcp.sh", "some-project"], { env: { ...process.env, SERVICE: name, AI_PROVIDER: "meta", GCLOUD: "false" }, encoding: "utf8" });
      expect(r.status, name).toBe(1);
      expect(r.stderr).toMatch(new RegExp(`refusing to deploy over ${name} \\(likeness-ai's service\\)`));
    }
  });
});

