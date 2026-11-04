/**
 * Pre-renders the visible render label (the container has no fonts) into lib/server/watermarks.ts as
 * LABEL_AI_RENDER_2L: two lines, "AI-generated" / "licensed likeness", white on a near-black pill with the
 * lime mark, drawn large so it scales down sharply. Also records LABEL_2L_TEXT_PX, one line's text height
 * in the PNG (top of "l" to bottom of "g"), which lib/server/label.ts scales to the image. Run on a machine
 * with system fonts: npx tsx scripts/make-label.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const W = 1000;
const H = 300;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="0" y="0" width="${W}" height="${H}" rx="56" fill="#121316"/>
  <circle cx="92" cy="150" r="38" fill="#DCF37B"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" fill="#FFFFFF">
    <text x="170" y="128" font-size="96">AI-generated</text>
    <text x="170" y="242" font-size="96">licensed likeness</text>
  </g>
</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
// Trim the pill to the text's width (plus padding).
const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const white = (x: number, y: number) => { const i = (y * info.width + x) * 4; return data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220; };
let right = 0;
const rows: number[] = [];
for (let y = 0; y < info.height; y++) for (let x = 150; x < info.width; x++) if (white(x, y)) { right = Math.max(right, x); rows.push(y); }
const width = Math.min(W, right + 64);
const trimmed = await sharp(Buffer.from(svg.replace(`width="${W}" height="${H}" rx`, `width="${width}" height="${H}" rx`).replace(`width="${W}" height="${H}">`, `width="${width}" height="${H}">`))).png().toBuffer();
// One line's text height: the first line's white rows (above the mid-line).
const first = rows.filter((y) => y < H / 2);
const textPx = Math.max(...first) - Math.min(...first) + 1;
const file = "lib/server/watermarks.ts";
let src = readFileSync(file, "utf8").replace(/\n\/\*\* Two lines[\s\S]*$/, "\n");
src += `/** Two lines, "AI-generated" / "licensed likeness", white on a near-black pill (scripts/make-label.mts). */
export const LABEL_AI_RENDER_2L = Buffer.from("${trimmed.toString("base64")}", "base64");
/** One line's text height in LABEL_AI_RENDER_2L, in pixels (top of "l" to bottom of "g"). */
export const LABEL_2L_TEXT_PX = ${textPx};
`;
writeFileSync(file, src);
const m = await sharp(trimmed).metadata();
console.log(JSON.stringify({ width: m.width, height: m.height, textPx }));
writeFileSync(process.argv[2] ?? "/dev/null", trimmed);
