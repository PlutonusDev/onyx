// Dependency-free PNG icon generator.
// Rasterises the app mark (a hollow diamond with a solid core) with 3x
// supersampling and encodes it with Node's built-in zlib, so regenerating the
// icons needs no image toolchain.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "icons");

const BG = [9, 9, 11];
const FG = [251, 191, 36];
const SS = 3; // supersampling factor per axis

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Coverage test for one sample point, in normalised [-1,1] space. */
function sample(nx, ny, maskable) {
  // Maskable icons are cropped to a safe circle, so shrink the mark to fit.
  const inset = maskable ? 0.66 : 1;
  const x = nx / inset;
  const y = ny / inset;

  // Chebyshev-rotated distance: |x| + |y| describes a diamond.
  const d = Math.abs(x) + Math.abs(y);
  const ring = d <= 0.78 && d >= 0.6; // hollow outline
  const core = d <= 0.3; // solid centre
  return ring || core;
}

function render(size, { maskable = false, radius = 0.18 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const cornerR = maskable ? 0 : size * radius;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      let bgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px_ = x + (sx + 0.5) / SS;
          const py_ = y + (sy + 0.5) / SS;

          // Rounded-square alpha mask (skipped for maskable, which is full-bleed).
          let inside = true;
          if (cornerR > 0) {
            const dx = Math.max(cornerR - px_, px_ - (size - cornerR), 0);
            const dy = Math.max(cornerR - py_, py_ - (size - cornerR), 0);
            inside = Math.hypot(dx, dy) <= cornerR;
          }
          if (!inside) continue;
          bgHits++;

          const nx = (px_ / size) * 2 - 1;
          const ny = (py_ / size) * 2 - 1;
          if (sample(nx, ny, maskable)) hits++;
        }
      }

      const total = SS * SS;
      const i = (y * size + x) * 4;
      if (bgHits === 0) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        continue;
      }
      const fgA = hits / bgHits;
      px[i] = Math.round(BG[0] + (FG[0] - BG[0]) * fgA);
      px[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * fgA);
      px[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * fgA);
      px[i + 3] = Math.round((bgHits / total) * 255);
    }
  }
  return encodePng(size, size, px);
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="92" fill="#09090b"/>
  <g transform="translate(256 256)">
    <path d="M0 -176 176 0 0 176 -176 0Z" fill="none" stroke="#fbbf24" stroke-width="34" stroke-linejoin="round"/>
    <path d="M0 -68 68 0 0 68 -68 0Z" fill="#fbbf24"/>
  </g>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "icon.svg"), SVG);
writeFileSync(join(OUT, "icon-192.png"), render(192));
writeFileSync(join(OUT, "icon-512.png"), render(512));
writeFileSync(join(OUT, "maskable-512.png"), render(512, { maskable: true }));
writeFileSync(join(OUT, "apple-icon.png"), render(180));
writeFileSync(join(HERE, "..", "public", "favicon.png"), render(64));

console.log(`icons written to ${OUT}`);

