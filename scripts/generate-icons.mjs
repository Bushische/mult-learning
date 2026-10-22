#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Generate the PWA app icons (no image tooling needed).
 * Draws a rounded slate square with a white "× = " sign and writes real PNGs.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps/web/public/icons");

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [15, 23, 42, 255];
const FG = [56, 189, 248, 255];
const WHITE = [248, 250, 252, 255];

function inRoundedSquare(x, y, size) {
  const radius = size * 0.22;
  const inset = size * 0.04;
  const min = inset;
  const max = size - inset;
  if (x < min || x > max || y < min || y > max) return false;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** A "×" (two diagonals) and an "=" (two bars) — the multiplication theme. */
function inCross(x, y, size) {
  const thickness = size * 0.075;
  const left = size * 0.16;
  const right = size * 0.56;
  if (x < left || x > right || y < size * 0.22 || y > size * 0.62) return false;
  const u = (x - left) / (right - left);
  const v = (y - size * 0.22) / (size * 0.4);
  return (
    Math.abs(u - v) < thickness / (right - left) + 0.02 ||
    Math.abs(u + v - 1) < thickness / (right - left) + 0.02
  );
}

function inEquals(x, y, size) {
  const thickness = size * 0.07;
  if (x < size * 0.64 || x > size * 0.86) return false;
  const top = size * 0.36;
  const bottom = size * 0.56;
  if (y >= top && y <= top + thickness) return true;
  if (y >= bottom && y <= bottom + thickness) return true;
  return false;
}

function pixel(x, y, size) {
  if (!inRoundedSquare(x, y, size)) return [0, 0, 0, 0];
  if (inCross(x, y, size) || inEquals(x, y, size)) return WHITE;
  return FG;
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png(size, pixel));
  console.log(`wrote ${file}`);
}
