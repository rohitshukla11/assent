import "server-only";
/**
 * The visible label on every render, "AI-generated" / "licensed likeness" on two lines: white on a
 * near-black pill (high contrast), its text scaled to the image (LABEL_TEXT_FRACTION of the shorter side,
 * at least LABEL_MIN_TEXT_PX), in a 4% safe area, in the corner that stays clear of the face and the area
 * below it (lib/server/framing.ts, labelSpot). Renders made before this keep the label they were made with.
 */
import sharp from "sharp";
import { faceBoxes, labelSpot, type Box } from "./framing";
import { LABEL_2L_TEXT_PX, LABEL_AI_RENDER_2L, WATERMARK_PROFILE } from "./watermarks";

export const LABEL_OPACITY = 0.9;
/** One line of the label's text: 2.75% of the image's shorter side (2.5–3%), at least 16 px. */
export const LABEL_TEXT_FRACTION = 0.0275;
export const LABEL_MIN_TEXT_PX = 16;
const LABEL_PNG = { w: 1000, h: 300 };

/** The label's size for a W×H image, and its text height; never wider than the image's safe area. */
export function labelSize(W: number, H: number): { w: number; h: number; textPx: number } {
  const want = Math.max(LABEL_MIN_TEXT_PX, Math.round(Math.min(W, H) * LABEL_TEXT_FRACTION));
  const margin = Math.round(Math.min(W, H) * 0.04);
  const scale = Math.min(want / LABEL_2L_TEXT_PX, (W - 2 * margin) / LABEL_PNG.w);
  return { w: Math.round(LABEL_PNG.w * scale), h: Math.round(LABEL_PNG.h * scale), textPx: Math.round(LABEL_2L_TEXT_PX * scale) };
}

/** The label PNG at width w, its alpha scaled to LABEL_OPACITY. */
export async function labelPng(w: number): Promise<{ png: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(LABEL_AI_RENDER_2L).resize({ width: w }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * LABEL_OPACITY);
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { png, w: info.width, h: info.height };
}

/** Faces for label placement; without the face models the label simply goes bottom-left. */
export async function facesForLabel(bytes: Uint8Array): Promise<Box[]> {
  return faceBoxes(bytes).then(
    (r) => r.faces,
    () => [],
  );
}

export async function labelRender(bytes: Uint8Array): Promise<Buffer> {
  const upright = await sharp(bytes).rotate().jpeg({ quality: 95 }).toBuffer();
  const { width = 1024, height = 1024 } = await sharp(upright).metadata();
  const label = await labelPng(labelSize(width, height).w);
  const spot = labelSpot(width, height, label, await facesForLabel(new Uint8Array(upright)));
  return sharp(upright).composite([{ input: label.png, left: spot.x, top: spot.y }]).jpeg({ quality: 92 }).toBuffer();
}

async function stamp(bytes: Uint8Array, mark: Buffer, fraction: number): Promise<Buffer> {
  const img = sharp(bytes).rotate();
  const { width = 1024, height = 1024 } = await img.metadata();
  const w = Math.max(160, Math.round(width * fraction));
  const label = await sharp(mark).resize({ width: w }).png().toBuffer();
  const lh = (await sharp(label).metadata()).height ?? 40;
  const margin = Math.round(width * 0.025);
  return img.composite([{ input: label, left: Math.max(0, width - w - margin), top: Math.max(0, height - lh - margin) }]).jpeg({ quality: 92 }).toBuffer();
}

/** The creator's public photo: 512 px, metadata removed, labelled "profile photo, not licensed for reuse". */
export async function publicPhoto(front: Uint8Array): Promise<Buffer> {
  const small = await sharp(front).rotate().resize(512, 512, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
  return stamp(small, WATERMARK_PROFILE, 0.62);
}
