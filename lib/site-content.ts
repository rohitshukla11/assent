/**
 * Marketing copy that is data, not code. Every number here is a real measurement with its source;
 * testimonials are real quotes only. An empty list hides the section entirely.
 */

export const MEASUREMENTS = {
  /** By construction: a render is charged and its KMS-signed receipt stored in one Firestore transaction. */
  rendersWithReceipt: {
    value: 100,
    source: "Every render is settled in one Firestore transaction that also stores its Cloud KMS-signed receipt",
  },
} as const;

export type Testimonial = { quote: string; name: string; role: string };

/** Real, attributed quotes only. Leave empty until there are some: the section is then not rendered. */
export const TESTIMONIALS: Testimonial[] = [];

/** The legal pages, on Firebase Hosting (hosting/ in the repo). */
export const LEGAL_SITE = "https://bionic-carving-140911.firebaseapp.com";
export const PRIVACY_URL = `${LEGAL_SITE}/privacy`;
export const TERMS_URL = `${LEGAL_SITE}/terms`;

/** The "Built on" strip: Meta's models first (Vertex AI Gemini is only the fallback provider, see the README). */
export const BUILT_ON: { name: string; role: string }[] = [
  { name: "Meta Muse Spark", role: "brand agent, policy check, reviewer" },
  { name: "Meta Muse Image", role: "image generation" },
  { name: "Meta SAM 3.1", role: "consent gate" },
  { name: "Firebase", role: "sign-in and data" },
  { name: "Cloud Run", role: "hosting" },
  { name: "Cloud KMS", role: "signed receipts and encrypted references" },
  { name: "C2PA", role: "content credentials" },
  { name: "YouTube", role: "creator verification" },
];
