/** likeness-meta never points at likeness-ai's Firestore database or bucket. */
import { afterEach, describe, expect, it } from "vitest";
import { gcp } from "./gcp";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("Google Cloud names", () => {
  it("default to likeness-meta's own database and bucket", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "p";
    delete process.env.FIRESTORE_DATABASE;
    delete process.env.GCS_BUCKET;
    expect(gcp.firestoreDb()).toBe("likeness-meta");
    expect(gcp.bucket()).toBe("p-likeness-meta-private");
  });
  it("refuse likeness-ai's database and bucket", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "p";
    process.env.FIRESTORE_DATABASE = "likeness";
    process.env.GCS_BUCKET = "p-likeness-private";
    expect(() => gcp.firestoreDb()).toThrow(/belongs to likeness-ai/);
    expect(() => gcp.bucket()).toThrow(/belongs to likeness-ai/);
  });
});
