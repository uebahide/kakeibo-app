// Builds every app icon from scripts/icon.svg: `node scripts/make-icons.mjs`.
// The source is full-bleed 512x512 with the background as its first <rect>; iPhone and Android mask the corners themselves.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const root = new URL("..", import.meta.url);
const out = (path) => new URL(path, root);
const source = readFileSync(out("scripts/icon.svg"), "utf8");

// Split the background from the drawing so the maskable icon can shrink the drawing into the safe zone.
const match = source.match(/^(<svg[^>]*>)(<defs>[\s\S]*?<\/defs>)?\s*(<rect[^>]*\/>)([\s\S]*)<\/svg>\s*$/);
if (!match) throw new Error("scripts/icon.svg must be <svg><defs/>?<rect background/>…</svg>");
const [, open, defs = "", background, drawing] = match;

const rounded = `${open}${defs}<clipPath id="corners"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#corners)">${background}${drawing}</g></svg>`;
const maskable = `${open}${defs}${background}<g transform="translate(256 256) scale(0.8) translate(-256 -256)">${drawing}</g></svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * (size / 512) * 4 }).resize(size, size).png().toBuffer();

// An .ico may hold PNG images directly; browsers pick the size they need.
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

writeFileSync(out("public/icon.svg"), rounded + "\n");
writeFileSync(out("public/icon-maskable.svg"), maskable + "\n");
writeFileSync(out("src/app/apple-icon.png"), await png(source, 180));
writeFileSync(out("public/icon-192.png"), await png(rounded, 192));
writeFileSync(out("public/icon-512.png"), await png(rounded, 512));
writeFileSync(out("public/icon-maskable-512.png"), await png(maskable, 512));
const sizes = [16, 32, 48];
writeFileSync(out("src/app/favicon.ico"), ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(rounded, size) })))));
