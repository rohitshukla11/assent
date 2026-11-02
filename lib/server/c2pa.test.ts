/** C2PA on an image render: the licence assertion is embedded, signed and read back (needs the local TEST cert). */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { embedManifest, readManifest } from "./c2pa";

const haveCert = existsSync(".secrets/c2pa/signer.pem");

describe.skipIf(!haveCert)("C2PA on an image render", () => {
  it("embeds the licence assertion and reads back a valid signature", async () => {
    const jpeg = new Uint8Array(await sharp({ create: { width: 512, height: 512, channels: 3, background: "#c9a27e" } }).jpeg().toBuffer());
    const signed = embedManifest(jpeg, "image/jpeg", {
      protocol: "likeness-ai/1", licenceId: "L", renderIndex: 0, renderType: "image",
      creator: { id: "c", name: "Demo", youtubeChannelId: null }, licensee: { id: "b", name: "Brew & Co." }, use: "advertising",
      receipt: { store: "Firestore receipts/{sha256}", key: "sha256 of this file, manifest included", signedBy: "Cloud KMS EC_SIGN_P256_SHA256", verify: "/verify" },
      renderer: { provider: "test", model: "none" }, promptSha256: "00", createdAt: new Date().toISOString(),
    });
    const m = await readManifest(signed, "image/jpeg");
    expect(m.present && m.licence?.renderType).toBe("image");
    expect(m.present && m.licence?.licenceId).toBe("L");
    expect(m.present && m.signatureValid).toBe(true);
  }, 30_000);

  it("names Assent as the generator and the receipt's issuer on new renders; files without an issuer still read", async () => {
    const jpeg = new Uint8Array(await sharp({ create: { width: 256, height: 256, channels: 3, background: "#c9a27e" } }).jpeg().toBuffer());
    const signed = embedManifest(jpeg, "image/jpeg", {
      protocol: "likeness-ai/1", licenceId: "L2", renderIndex: 1, renderType: "image",
      creator: { id: "c", name: "Demo", youtubeChannelId: null }, licensee: { id: "b", name: "Brew & Co." }, use: "advertising",
      receipt: { issuer: "Assent", store: "Firestore receipts/{sha256}", key: "sha256 of this file, manifest included", signedBy: "Cloud KMS EC_SIGN_P256_SHA256", verify: "https://example.test/verify" },
      renderer: { provider: "test", model: "none" }, promptSha256: "00", createdAt: new Date().toISOString(),
    });
    const m = await readManifest(signed, "image/jpeg");
    expect(m.present && m.generator).toBe("Assent render service");
    expect(m.present && (m.licence as { receipt?: { issuer?: string; verify?: string } }).receipt).toMatchObject({ issuer: "Assent", verify: "https://example.test/verify" });
    expect(m.present && m.signatureValid).toBe(true);
  }, 30_000);

  it("a file signed with the earlier test certificate (Likeness) still verifies after the switch to Assent's", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c2pa-old-"));
    const assertion = (licenceId: string) => ({
      protocol: "likeness-ai/1" as const, licenceId, renderIndex: 0, renderType: "image" as const,
      creator: { id: "c", name: "Demo", youtubeChannelId: null }, licensee: { id: "b", name: "Brew & Co." }, use: "advertising",
      receipt: { store: "Firestore receipts/{sha256}" as const, key: "sha256 of this file, manifest included" as const, signedBy: "Cloud KMS EC_SIGN_P256_SHA256" as const, verify: "/verify" },
      renderer: { provider: "test", model: "none" }, promptSha256: "00", createdAt: new Date().toISOString(),
    });
    try {
      execFileSync("sh", ["scripts/c2pa-testcert.sh"], { env: { ...process.env, C2PA_DIR: dir, C2PA_NAME: "Likeness", C2PA_ORG: "Likeness (test only)" }, stdio: "ignore" });
      const jpeg = new Uint8Array(await sharp({ create: { width: 256, height: 256, channels: 3, background: "#7ea2c9" } }).jpeg().toBuffer());
      process.env.C2PA_CERT_FILE = join(dir, "signer.pem");
      process.env.C2PA_KEY_FILE = join(dir, "signer.key");
      const old = embedManifest(jpeg, "image/jpeg", assertion("OLD") as never);
      delete process.env.C2PA_CERT_FILE;
      delete process.env.C2PA_KEY_FILE;
      const now = embedManifest(jpeg, "image/jpeg", assertion("NEW") as never);
      const [a, b] = [await readManifest(old, "image/jpeg"), await readManifest(now, "image/jpeg")];
      expect(a.present && a.signatureValid).toBe(true);
      expect(a.present && a.licence?.licenceId).toBe("OLD");
      expect(a.present && `${a.signer.commonName} ${a.signer.issuer}`).toMatch(/Likeness/);
      expect(b.present && b.signatureValid).toBe(true);
      expect(b.present && `${b.signer.commonName} ${b.signer.issuer}`).toMatch(/Assent/);
    } finally {
      delete process.env.C2PA_CERT_FILE;
      delete process.env.C2PA_KEY_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

